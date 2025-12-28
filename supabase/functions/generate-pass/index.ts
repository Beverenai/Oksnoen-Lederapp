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
  littleStyrkeprove: boolean;
  bigStyrkeprove: boolean;
}

const SYSTEM_PROMPT = `Du er en leirsjef på Oksnøen sommerleir som skriver personlige pass til deltakerne.

Regler for pass-skriving på Oksnøen:
- Passet skal være personlig og oppmuntrende
- Bruk deltakerens fornavn
- Nevn 2-3 aktiviteter de har gjort (velg de mest spennende)
- Hvis de har klart Lille eller Store Styrkeprøven, fremhev dette som en stor prestasjon
- Hold passet kort (2-3 setninger)
- Skriv på norsk bokmål
- Vær entusiastisk men ikke overdrevent
- Avslutt med en positiv hilsen

Eksempler på gode pass:
- "Ola har hatt en fantastisk uke på Oksnøen! Med stor mot har han klart Store Styrkeprøven og vist at han tør å utfordre seg selv i klatreveggen og taubanen. Flott innsats, Ola!"
- "Lisa har virkelig kastet seg ut i leirlivet! Hun har prøvd alt fra pil og bue til kano, og vi er imponert over motet hennes. Håper vi sees igjen neste år!"
- "Emil har klart Lille Styrkeprøven og vært en super deltaker på leiren. Han har vist god lagånd og alltid et smil på lur. Takk for en fin uke, Emil!"`;

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
      const userPrompt = `Skriv et pass for denne deltakeren:

Navn: ${participant.name}
Alder: ${participant.age ? `${participant.age} år` : 'Ukjent'}
Hytte: ${participant.cabin || 'Ukjent'}
Aktiviteter gjort: ${participant.activities.length > 0 ? participant.activities.join(', ') : 'Ingen registrert'}
Styrkeprøve: ${participant.bigStyrkeprove ? 'Store Styrkeprøven ✅' : participant.littleStyrkeprove ? 'Lille Styrkeprøven ✅' : 'Ingen styrkeprøve'}

Skriv passet nå:`;

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
