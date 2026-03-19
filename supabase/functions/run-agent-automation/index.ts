import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const TELEGRAM_BOT_TOKEN = "8765053225:AAHfNtVbKJoFp8u1Ht4bkoeS5yD0vW-WNoQ";
const TELEGRAM_CHANNEL = "@meeetworld";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendTelegramNotification(message: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Telegram notification failed:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all running deployed agents with their agent details
    const { data: deployedAgents, error: daError } = await supabase
      .from("deployed_agents")
      .select("id, agent_id, agents(id, name, agent_class, balance_meeet)")
      .eq("status", "running");

    if (daError) return json({ error: daError.message }, 500);
    if (!deployedAgents || deployedAgents.length === 0) {
      return json({ message: "No running agents found", processed: 0 });
    }

    const results: Array<{ deployed_agent_id: string; agent_name: string; earnings: number; quests_completed: number }> = [];

    for (const da of deployedAgents) {
      const agent = (da as any).agents;
      if (!agent) continue;

      // Find open quests matching this agent class
      const { data: quests, error: questsError } = await supabase
        .from("quests")
        .select("id, title, reward_meeet, required_class, proof_template")
        .eq("status", "open")
        .or(`required_class.eq.${agent.agent_class},required_class.is.null`);

      if (questsError || !quests || quests.length === 0) continue;

      let totalEarned = 0;
      let questsCompleted = 0;

      for (const quest of quests) {
        // Check if this agent already completed this quest
        const { data: existing } = await supabase
          .from("agent_earnings")
          .select("id")
          .eq("agent_id", agent.id)
          .eq("quest_id", quest.id)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Generate proof text
        const proofText = quest.proof_template
          ? quest.proof_template.replace("{agent_name}", agent.name).replace("{agent_class}", agent.agent_class)
          : `Agent ${agent.name} (${agent.agent_class}) completed quest: ${quest.title}`;

        // Record earning
        const { error: earnError } = await supabase
          .from("agent_earnings")
          .insert({
            agent_id: agent.id,
            quest_id: quest.id,
            amount_meeet: quest.reward_meeet,
            proof_text: proofText,
          });

        if (earnError) {
          console.error(`Failed to record earning for agent ${agent.id}, quest ${quest.id}:`, earnError.message);
          continue;
        }

        totalEarned += quest.reward_meeet;
        questsCompleted++;

        // Send Telegram notification if earning > 100 MEEET
        if (quest.reward_meeet > 100) {
          await sendTelegramNotification(
            `🤖 <b>Agent Milestone!</b>\n` +
            `Agent <b>${agent.name}</b> (${agent.agent_class}) earned <b>${quest.reward_meeet} MEEET</b>\n` +
            `Quest: ${quest.title}`
          );
        }
      }

      // Update agent balance if any earnings
      if (totalEarned > 0) {
        await supabase
          .from("agents")
          .update({ balance_meeet: (agent.balance_meeet ?? 0) + totalEarned })
          .eq("id", agent.id);

        results.push({
          deployed_agent_id: da.id,
          agent_name: agent.name,
          earnings: totalEarned,
          quests_completed: questsCompleted,
        });
      }
    }

    return json({
      message: "Automation run complete",
      processed: deployedAgents.length,
      results,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
