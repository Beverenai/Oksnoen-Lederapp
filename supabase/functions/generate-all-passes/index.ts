import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { differenceInYears } from "https://esm.sh/date-fns@3.6.0";

// Declare EdgeRuntime for Deno
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParticipantData {
  id: string;
  name: string;
  age?: number;
  cabin?: string;
  activities: string[];
  activityNotes?: string;
  littleStyrkeprove: boolean;
  bigStyrkeprove: boolean;
}

const SYSTEM_PROMPT = `Du er en leirsjef på Oksnøen sommerleir som skriver personlige pass til deltakerne.

Du skal skrive en hyggelig og personlig tekst som skal trykkes i et "Oksnøen-pass" til en deltager som har vært på sommerleir.
Tonen skal være varm, leken, positiv og ekte – slik en snill leirleder ville skrevet.
Språket skal være på norsk, rett frem og barnevennlig.

BRUK DENNE STRUKTUREN (men varier formuleringene naturlig):
1. Start med fornavn, 2–3 positive adjektiver og hytte + kjønn (gutt/jente basert på navn)
2. Beskriv kort hvordan barnet er på leir (humør, energi, væremåte)
3. Nevn 2–4 aktiviteter barnet har gjort (velg naturlig formulering)
4. Avslutt med en varm hilsen (god sommer / håper vi ses igjen / vi digger deg)

REGLER:
- Ikke bruk samme adjektiv to ganger i samme tekst
- Varier åpninger (ikke alltid "er en")
- Bruk riktig pronomen (han/hun) basert på navnet
- Ikke overdriv, men vær entusiastisk
- Skriv 5–6 setninger totalt
- Av og til bruk uttrykket "ekte Oksnøyaner"
- VIKTIG: Hvis det finnes "Aktivitetsnotater fra ledere", bruk disse! De inneholder prestasjoner (f.eks. "1. plass i svømmekonkurranse", "rekord i bruskasser")
- Hvis de har klart Lille eller Store Styrkeprøven, fremhev dette som en stor prestasjon

GODE ADJEKTIVER Å BRUKE (varier):
søt, snill, herlig, sprudlende, rå, tøff, kul, sjarmerende, aktiv, glad, skjønn, god, morsom, hyggelig, flott, supertrivelig

EKSEMPLER PÅ GODE PASS:

"Emilie er en søt Berit-Bu jente som alltid smiler og koser seg på leir. Hun har kjørt tube, skutt pil og bue og badet masse. Håper å se deg til neste år!"

"Heddy er en aktiv jente fra Styrbord som har blitt sett stående på vannski, klatret i fjellveggen og hoppet fra 13 meter. Du er sykt morsom å ha på leir, så vi håper å se deg til neste år også!"

"Henrik er en luring som får alle til å le. Han blir ofte sett i stallen med hestene. Barbak-ridning var en favoritt. Henrik er også en badenymfe som har herjet på tube gjennom hele perioden. God sommer! Håper vi ses til neste år."

"Albert er en sjarmerende og kul Balder-gutt som alltid finner på noe sprell. Han har slengt seg bak tuben og rocker skikkelig på discs. Kult! Vi digger deg! God sommer!"

"Mikkel er en herlig og tøff gutt som har kjørt vannski, tube, kom på 3. plass i triatlon og deltatt på sjøslag. Håper vi ses igjen neste sommer!"

"Ella er en skjønn Hulder-jente som har kost seg med tube gang på gang, stått masse på vannski, klatret og mye mer. Vi håper å se deg igjen neste år!"

"Ada er en rå Berit-Bu jente som vi elsker å ha på leir. Hun har deltatt på en rekke aktiviteter i tillegg til å hoppe fra 13-meteren og tatt taubanen baklengs. Vi digger deg!"

"Charlotte har vært en fantastisk jente å ha på leir. Hun er en ekte glad og morsom jente man ikke kan unngå å bli glad i. Hun er med på overnatting, dramakurs med forestilling, klatrer i fjellveggen og stått på vannski. Håper å se deg neste år!"`;

// Mapping of shortened/alternative activity names to canonical names
const ACTIVITY_NAME_MAPPING: Record<string, string[]> = {
  'tretten meter': ['tretten', '13 meter', '13m', 'trettenmeteren'],
  'åtte meter': ['åtte', '8 meter', '8m', 'åttemeteren'],
  'ti meter': ['ti', '10 meter', '10m', 'timeteren'],
  'skrikeren begge veier': ['svømming begge veier', 'begge veier', 'svømming til skrikeren begge veier'],
  'skrikeren en vei': ['svømming en vei', 'en vei', 'svømming til skrikeren en vei'],
  'klatring': ['klatre', 'klatrevegg'],
  'rappis': ['rappelering', 'rappell', 'rappelling'],
  'taubane': ['zipline', 'zip-line'],
  'triatlon': ['triathlon'],
};

// Store Styrkeprøven requirements (all must be completed)
const STORE_STYRKEPROVE_REQUIREMENTS = [
  'Tretten meter',
  'Skrikeren begge veier',
  'Klatring',
  'Taubane',
  'Rappis',
];

// Lille Styrkeprøven fixed requirements (all must be completed)
const LILLE_FIXED_REQUIREMENTS = [
  'Klatring',
  'Rappis',
  'Taubane',
];

// Height alternatives - at least one must be completed
const LILLE_HEIGHT_ALTERNATIVES = ['Åtte meter', 'Ti meter'];

// Swimming alternatives - at least one must be completed
const LILLE_SWIMMING_ALTERNATIVES = ['Skrikeren en vei', 'Triatlon'];

function matchesRequirement(activities: string[], requirement: string): boolean {
  const normalizedReq = requirement.toLowerCase().trim();
  const altNames = ACTIVITY_NAME_MAPPING[normalizedReq] || [];
  
  return activities.some(a => {
    const normalized = a.toLowerCase().trim();
    
    // Exact match with requirement
    if (normalized === normalizedReq) return true;
    
    // Match with any alternative name
    if (altNames.includes(normalized)) return true;
    
    // Partial match - activity starts with requirement or vice versa
    if (normalized.startsWith(normalizedReq) || normalizedReq.startsWith(normalized)) return true;
    
    // Partial match with alternatives
    if (altNames.some(alt => normalized.startsWith(alt) || alt.startsWith(normalized))) return true;
    
    return false;
  });
}

function hasAnyOf(activities: string[], alternatives: string[]): boolean {
  return alternatives.some(alt => matchesRequirement(activities, alt));
}

function hasLilleStyrkprove(activities: string[]): boolean {
  // All fixed requirements must be met
  const hasAllFixed = LILLE_FIXED_REQUIREMENTS.every(req => 
    matchesRequirement(activities, req)
  );
  
  // At least one height alternative must be met (8 meter OR 10 meter)
  const hasHeight = hasAnyOf(activities, LILLE_HEIGHT_ALTERNATIVES);
  
  // At least one swimming alternative must be met (Skrikeren en vei OR Triatlon)
  const hasSwimming = hasAnyOf(activities, LILLE_SWIMMING_ALTERNATIVES);
  
  return hasAllFixed && hasHeight && hasSwimming;
}

function hasStoreStyrkprove(activities: string[]): boolean {
  return STORE_STYRKEPROVE_REQUIREMENTS.every(req => 
    matchesRequirement(activities, req)
  );
}

function getUniqueActivities(activities: string[]): string[] {
  return [...new Set(activities)];
}

async function updateProgress(supabase: any, status: string, processed: number, total: number, error?: string) {
  const progressData = JSON.stringify({ status, processed, total, error });
  await supabase
    .from('app_config')
    .upsert({ key: 'checkout_progress', value: progressData }, { onConflict: 'key' });
}

async function generatePassForParticipant(participant: ParticipantData, LOVABLE_API_KEY: string): Promise<string> {
  const firstName = participant.name.split(' ')[0];
  
  const userPrompt = `Skriv et pass for denne deltakeren:

Fornavn: ${firstName}
Fullt navn: ${participant.name}
Alder: ${participant.age ? `${participant.age} år` : 'Ukjent'}
Hytte: ${participant.cabin || 'Ukjent'}
Aktiviteter gjort: ${participant.activities.length > 0 ? participant.activities.join(', ') : 'Ingen registrert'}
${participant.activityNotes ? `Aktivitetsnotater fra ledere: ${participant.activityNotes}` : ''}
Styrkeprøve: ${participant.bigStyrkeprove ? 'Store Styrkeprøven ✅' : participant.littleStyrkeprove ? 'Lille Styrkeprøven ✅' : 'Ingen styrkeprøve'}

Skriv passet nå (5-6 setninger):`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI gateway error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Kunne ikke generere pass.";
}

async function processAllParticipants(supabase: any, LOVABLE_API_KEY: string) {
  console.log('Starting background pass generation...');
  
  try {
    // Fetch all data
    const [participantsRes, cabinsRes, activitiesRes] = await Promise.all([
      supabase.from('participants').select('id, name, birth_date, cabin_id, activity_notes'),
      supabase.from('cabins').select('id, name'),
      supabase.from('participant_activities').select('participant_id, activity'),
    ]);

    if (participantsRes.error) throw participantsRes.error;
    if (cabinsRes.error) throw cabinsRes.error;
    if (activitiesRes.error) throw activitiesRes.error;

    const participants = participantsRes.data || [];
    const cabins = cabinsRes.data || [];
    const activities = activitiesRes.data || [];

    const total = participants.length;
    console.log(`Processing ${total} participants`);

    await updateProgress(supabase, 'running', 0, total);

    // Helper functions
    const getCabinName = (cabinId: string | null): string => {
      if (!cabinId) return 'Ukjent';
      return cabins.find((c: any) => c.id === cabinId)?.name || 'Ukjent';
    };

    const getParticipantActivities = (participantId: string): string[] => {
      return activities
        .filter((a: any) => a.participant_id === participantId)
        .map((a: any) => a.activity);
    };

    // Process participants one by one
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      
      try {
        const completedActivities = getParticipantActivities(p.id);
        const uniqueActivities = getUniqueActivities(completedActivities);
        const age = p.birth_date ? differenceInYears(new Date(), new Date(p.birth_date)) : undefined;

        const participantData: ParticipantData = {
          id: p.id,
          name: p.name,
          age,
          cabin: getCabinName(p.cabin_id),
          activities: uniqueActivities,
          activityNotes: p.activity_notes,
          littleStyrkeprove: hasLilleStyrkprove(completedActivities),
          bigStyrkeprove: hasStoreStyrkprove(completedActivities),
        };

        console.log(`Generating pass for ${p.name} (${i + 1}/${total})`);
        
        const suggestion = await generatePassForParticipant(participantData, LOVABLE_API_KEY);

        // Update database with suggestion
        const { error: updateError } = await supabase
          .from('participants')
          .update({ pass_suggestion: suggestion })
          .eq('id', p.id);

        if (updateError) {
          console.error(`Error updating participant ${p.id}:`, updateError);
        }

        // Update progress
        await updateProgress(supabase, 'running', i + 1, total);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error processing participant ${p.name}:`, error);
        // Continue with next participant
      }
    }

    // Enable checkout and mark as done
    await supabase
      .from('app_config')
      .upsert({ key: 'checkout_enabled', value: 'true' }, { onConflict: 'key' });

    await updateProgress(supabase, 'done', total, total);
    console.log('Pass generation complete!');
  } catch (error) {
    console.error('Error in background processing:', error);
    await updateProgress(supabase, 'error', 0, 0, error instanceof Error ? error.message : 'Unknown error');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Reset progress and set to running
    await updateProgress(supabase, 'starting', 0, 0);

    // Start background task
    EdgeRuntime.waitUntil(processAllParticipants(supabase, LOVABLE_API_KEY));

    // Return immediately
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Pass generation started in background' 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-all-passes function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
