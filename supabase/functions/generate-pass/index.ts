import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { participants, single } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: { id: string; suggestion: string }[] = [];

    // Process participants (either single or batch)
    const participantList: ParticipantData[] = single ? [participants] : participants;

    for (const participant of participantList) {
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

      console.log(`Generating pass for ${participant.name}`);

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
        if (response.status === 429) {
          console.error("Rate limited");
          return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          console.error("Payment required");
          return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const suggestion = data.choices?.[0]?.message?.content || "Kunne ikke generere pass.";
      
      results.push({ id: participant.id, suggestion });

      // Update database with suggestion
      const { error: updateError } = await supabase
        .from('participants')
        .update({ pass_suggestion: suggestion })
        .eq('id', participant.id);

      if (updateError) {
        console.error(`Error updating participant ${participant.id}:`, updateError);
      }

      // Small delay between requests to avoid rate limiting
      if (!single && participantList.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-pass function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
