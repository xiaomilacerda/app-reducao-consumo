import type { SupabaseClient } from "@supabase/supabase-js";

export async function rpcUpsertUserMission(
  supabase: SupabaseClient,
  args: {
    p_mission_id: number;
    p_status?: "pending" | "in_progress" | "completed" | string | null;
    p_progress?: Record<string, any> | null;
    p_notes?: string | null;
    p_source?: string | null;
  }
) {
  const { error } = await supabase.rpc("upsert_user_mission", {
    p_mission_id: args.p_mission_id,
    p_status: args.p_status ?? null,
    p_progress: args.p_progress ?? null,
    p_notes: args.p_notes ?? null,
    p_source: args.p_source ?? null,
  });

  if (error) throw error;
}

export async function rpcCompleteJourneyDay(
  supabase: SupabaseClient,
  args: {
    p_journey_day: number;
    p_answer?: string | null;
  }
) {
  const { error } = await supabase.rpc("complete_journey_day", {
    p_journey_day: args.p_journey_day,
    p_answer: args.p_answer ?? null,
  });

  if (error) throw error;
}

export async function rpcUpsertMissionJournal(
  supabase: SupabaseClient,
  args: {
    p_journey_day: number;
    p_answer: string;
  }
) {
  const { error } = await supabase.rpc("upsert_mission_journal", {
    p_journey_day: args.p_journey_day,
    p_answer: args.p_answer,
  });

  if (error) throw error;
}
