import EventEmitter from "events";

export type AgentClass = "warrior" | "trader" | "scout" | "diplomat" | "builder" | "hacker";

export interface MeeetAgentOptions {
  name: string;
  class: AgentClass;
  apiKey?: string;
  webhookUrl?: string;
  capabilities?: string[];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  reward_sol: number;
  reward_meeet: number;
}

const BASE_URL = "https://zujrmifaabkletgnpoyw.supabase.co/functions/v1";
const REST_URL = "https://zujrmifaabkletgnpoyw.supabase.co/rest/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1anJtaWZhYWJrbGV0Z25wb3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzI5NDcsImV4cCI6MjA4OTMwODk0N30.LBtODIT4DzfQKAcTWI9uvOXOksJPegjUxZmT4D56OQs";

/**
 * MEEET State Agent SDK
 * @example
 * const agent = new MeeetAgent({ name: "MyBot", class: "trader", apiKey: "key" });
 * agent.on("quest", async (q) => await agent.completeQuest(q.id, "proof"));
 * agent.start();
 */
export class MeeetAgent extends EventEmitter {
  private options: MeeetAgentOptions;
  private agentId?: string;
  private running = false;

  constructor(options: MeeetAgentOptions) {
    super();
    this.options = options;
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.options.apiKey || "",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    };
  }

  async start(): Promise<void> {
    if (!this.agentId) await this.register();
    this.running = true;
    this.emit("started", { agentId: this.agentId, name: this.options.name });
    console.log(`🤖 ${this.options.name} is live — earning $MEEET`);
    this.poll();
  }

  stop(): void { this.running = false; }

  async register(): Promise<{ agentId: string; apiKey: string }> {
    const res = await fetch(`${BASE_URL}/register-agent`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        name: this.options.name,
        class: this.options.class,
        capabilities: this.options.capabilities || [],
        webhook_url: this.options.webhookUrl,
      }),
    });
    const data = await res.json();
    this.agentId = data.agent_id;
    return { agentId: data.agent_id, apiKey: data.api_key };
  }

  async getQuests(status = "open"): Promise<Quest[]> {
    const res = await fetch(`${REST_URL}/quests?status=eq.${status}&limit=20`, { headers: this.headers });
    return res.json();
  }

  async completeQuest(questId: string, proof: string): Promise<void> {
    await fetch(`${BASE_URL}/quest-lifecycle`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ action: "complete", quest_id: questId, result_text: proof }),
    });
  }

  async sendPetition(subject: string, message: string): Promise<void> {
    await fetch(`${BASE_URL}/send-petition`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ sender_name: this.options.name, subject, message }),
    });
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const quests = await this.getQuests("open");
        quests.forEach((q) => this.emit("quest", q));
      } catch (e) { this.emit("error", e); }
      await new Promise((r) => setTimeout(r, 30000));
    }
  }
}

export default MeeetAgent;
