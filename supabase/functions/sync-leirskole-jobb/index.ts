import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_JOBB_EXPORT_URL =
  "https://hiifcjletsoklagflnvn.supabase.co/functions/v1/export-leirskole";

type ExportStaff = {
  external_ref: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role_label?: string | null;
  max_daily_hours?: number | null;
  employment_status?: string | null;
  availability?: ExportAvailability[] | null;
};

type ExportAvailability = {
  date: string;
  available?: boolean | null;
  from_time?: string | null;
  to_time?: string | null;
};

type ExportWeek = {
  external_ref: string;
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  source_schedule_published_at?: string | null;
  staff?: ExportStaff[] | null;
  posts?: ExportPost[] | null;
  assignments?: ExportAssignment[] | null;
};

type ExportPost = {
  external_ref: string;
  date: string;
  name: string;
  post_type?: string | null;
  start_time: string;
  end_time: string;
  crosses_midnight?: boolean | null;
  required_leaders?: number | null;
  is_main_shift?: boolean | null;
  is_night?: boolean | null;
  sort_order?: number | null;
  notes?: string | null;
};

type ExportAssignment = {
  external_ref: string;
  post_ref: string;
  leader_ref: string;
  is_locked?: boolean | null;
  assigned_manually?: boolean | null;
};

type Leader = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

const normName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/\s+/g, " ");

const normEmail = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const normPhone = (value?: string | null) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length < 8) return "";
  return digits.slice(-8);
};

function uniqueLeaderIndex(leaders: Leader[], key: (leader: Leader) => string) {
  const index = new Map<string, string | null>();
  for (const leader of leaders) {
    const value = key(leader);
    if (!value) continue;
    index.set(value, index.has(value) ? null : leader.id);
  }
  return index;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validTime(value: unknown): value is string {
  return typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function integerAtLeast(value: unknown, minimum: number, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) &&
      value >= minimum
    ? value
    : fallback;
}

function normalizeAvailability(person: ExportStaff, week: ExportWeek) {
  if (!Array.isArray(person.availability)) return [];
  const byDate = new Map<string, {
    date: string;
    available: boolean;
    from_time: string | null;
    to_time: string | null;
  }>();
  for (const row of person.availability) {
    if (
      !validDate(row?.date) || row.date < week.start_date ||
      row.date > week.end_date
    ) continue;
    byDate.set(row.date, {
      date: row.date,
      available: row.available !== false,
      from_time: validTime(row.from_time) ? row.from_time : null,
      to_time: validTime(row.to_time) ? row.to_time : null,
    });
  }
  return [...byDate.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Ikke innlogget" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await userClient.auth
      .getUser();
    if (userError || !userData?.user) {
      return json({ error: "Ikke innlogget" }, 401);
    }
    const { data: isAdmin, error: adminError } = await userClient.rpc(
      "is_admin",
    );
    if (adminError || !isAdmin) return json({ error: "Kun admin" }, 403);

    const secret = Deno.env.get("LEIRSKOLE_SYNC_SECRET");
    if (!secret) return json({ error: "Mangler LEIRSKOLE_SYNC_SECRET" }, 500);

    const exportUrl = Deno.env.get("LEIRSKOLE_JOBB_EXPORT_URL") ??
      DEFAULT_JOBB_EXPORT_URL;
    const res = await fetch(exportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": secret },
      body: JSON.stringify({ source: "lederapp", contract_version: 2 }),
    });
    const responseText = await res.text();
    if (!res.ok) {
      const message = res.status === 404
        ? "Eksport-funksjonen «export-leirskole» er ikke satt opp på jobb-plattformen ennå. Legg den ut der først."
        : res.status === 401 || res.status === 403
        ? "Jobb-plattformen avviste nøkkelen (LEIRSKOLE_SYNC_SECRET må være lik i begge appene)."
        : `Jobb-plattformen svarte ${res.status}`;
      return json({
        error: message,
        status: res.status,
        detail: responseText.slice(0, 300),
      });
    }

    let payload: {
      contract_version?: number;
      full_snapshot?: boolean;
      weeks?: ExportWeek[];
    };
    try {
      payload = JSON.parse(responseText);
    } catch {
      return json({ error: "Ugyldig svar fra jobb-plattformen" }, 200);
    }
    if (payload.contract_version !== 2) {
      return json({
        error: "Jobbplattformen bruker en utdatert eksportkontrakt",
      });
    }

    const weeks = Array.isArray(payload.weeks) ? payload.weeks : [];
    if (!weeks.length) {
      return json({
        weeks: 0,
        linked: 0,
        already_linked: 0,
        removed: 0,
        posts: 0,
        assignments: 0,
        skipped_assignments: 0,
        unmatched: [],
        errors: [],
        message: "Ingen uker å hente",
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: leaderRows, error: leaderError } = await admin
      .from("leaders")
      .select("id, name, email, phone")
      .is("deleted_at", null);
    if (leaderError) return json({ error: leaderError.message }, 500);

    const leaders = (leaderRows ?? []) as Leader[];
    const leaderById = new Map(leaders.map((leader) => [leader.id, leader]));
    const byPhone = uniqueLeaderIndex(
      leaders,
      (leader) => normPhone(leader.phone),
    );
    const byEmail = uniqueLeaderIndex(
      leaders,
      (leader) => normEmail(leader.email),
    );
    const byName = uniqueLeaderIndex(
      leaders,
      (leader) => normName(leader.name),
    );

    const [importsResult, staffResult] = await Promise.all([
      admin
        .from("leirskole_job_imports")
        .select("external_ref, linked_leader_id")
        .not("linked_leader_id", "is", null),
      admin
        .from("leirskole_staff")
        .select("external_ref, leader_id")
        .not("external_ref", "is", null),
    ]);
    if (importsResult.error) {
      return json({ error: importsResult.error.message }, 500);
    }
    if (staffResult.error) {
      return json({ error: staffResult.error.message }, 500);
    }
    const previousImports = importsResult.data;
    const previousStaff = staffResult.data;

    const linkedByExternalRef = new Map<string, string>();
    for (const row of previousImports ?? []) {
      if (
        row.external_ref && row.linked_leader_id &&
        leaderById.has(row.linked_leader_id)
      ) {
        linkedByExternalRef.set(row.external_ref, row.linked_leader_id);
      }
    }
    for (const row of previousStaff ?? []) {
      if (row.external_ref && row.leader_id && leaderById.has(row.leader_id)) {
        linkedByExternalRef.set(row.external_ref, row.leader_id);
      }
    }

    let importedWeeks = 0;
    let linkedStaff = 0;
    let alreadyLinked = 0;
    let removedStaff = 0;
    let importedPosts = 0;
    let importedAssignments = 0;
    let skippedAssignments = 0;
    const unmatched: Array<{
      external_ref: string;
      name: string;
      email: string | null;
      phone: string | null;
      week: string;
    }> = [];
    const errors: string[] = [];

    for (const week of weeks) {
      if (
        !week?.external_ref ||
        !week?.name?.trim() ||
        !validDate(week.start_date) ||
        !validDate(week.end_date) ||
        week.start_date > week.end_date
      ) {
        errors.push(
          `Hoppet over en uke med ugyldige data: ${week?.name ?? "uten navn"}`,
        );
        continue;
      }

      const sourcePublishedAt =
        validTimestamp(week.source_schedule_published_at)
          ? new Date(week.source_schedule_published_at).toISOString()
          : null;
      if (week.source_schedule_published_at && !sourcePublishedAt) {
        errors.push(`${week.name}: ugyldig tidspunkt for publisert vaktplan`);
      }

      const { data: sourceWeek, error: existingWeekError } = await admin
        .from("leirskole_weeks")
        .select("id")
        .eq("external_ref", week.external_ref)
        .maybeSingle();
      if (existingWeekError) {
        errors.push(`${week.name}: ${existingWeekError.message}`);
        continue;
      }

      let existingWeek = sourceWeek;
      if (!existingWeek) {
        const { data: matchingWeeks, error: matchingWeeksError } = await admin
          .from("leirskole_weeks")
          .select("id")
          .is("external_ref", null)
          .eq("start_date", week.start_date)
          .eq("end_date", week.end_date)
          .limit(2);
        if (matchingWeeksError) {
          errors.push(`${week.name}: ${matchingWeeksError.message}`);
          continue;
        }
        if ((matchingWeeks?.length ?? 0) > 1) {
          errors.push(
            `${week.name}: flere eksisterende uker har de samme datoene`,
          );
          continue;
        }
        existingWeek = matchingWeeks?.[0] ?? null;
      }

      const weekQuery = existingWeek
        ? admin
          .from("leirskole_weeks")
          .update({
            external_ref: week.external_ref,
            name: week.name.trim(),
            start_date: week.start_date,
            end_date: week.end_date,
            notes: week.notes ?? null,
            schedule_published_at: sourcePublishedAt,
          })
          .eq("id", existingWeek.id)
        : admin.from("leirskole_weeks").insert({
          external_ref: week.external_ref,
          name: week.name.trim(),
          start_date: week.start_date,
          end_date: week.end_date,
          notes: week.notes ?? null,
          is_active: false,
          schedule_published_at: sourcePublishedAt,
        });

      const { data: weekRow, error: weekError } = await weekQuery.select("id")
        .single();

      if (weekError || !weekRow) {
        errors.push(
          `${week.name}: ${weekError?.message ?? "kunne ikke lagre uken"}`,
        );
        continue;
      }
      importedWeeks++;
      const staffIdByExternalRef = new Map<string, string>();

      const activeExternalRefs = new Set(
        (week.staff ?? [])
          .filter((person) =>
            person?.external_ref && person.employment_status === "hired"
          )
          .map((person) => person.external_ref),
      );

      for (const person of week.staff ?? []) {
        if (!person?.external_ref) {
          errors.push(`${week.name}: en person mangler external_ref`);
          continue;
        }
        if (person.employment_status !== "hired") {
          errors.push(
            `${week.name}: hoppet over ${
              person.name?.trim() || person.external_ref
            } uten status hired`,
          );
          continue;
        }

        const name = person.name?.trim() ?? "";
        const email = normEmail(person.email);
        const phone = normPhone(person.phone);
        const availability = normalizeAvailability(person, week);
        let leaderId = linkedByExternalRef.get(person.external_ref) ?? null;
        let matchMethod = leaderId ? "saved" : null;

        if (!leaderId && phone) {
          leaderId = byPhone.get(phone) ?? null;
          if (leaderId) matchMethod = "phone";
        }
        if (!leaderId && email) {
          leaderId = byEmail.get(email) ?? null;
          if (leaderId) matchMethod = "email";
        }
        if (!leaderId && name) {
          leaderId = byName.get(normName(name)) ?? null;
          if (leaderId) matchMethod = "name";
        }

        const { error: importError } = await admin
          .from("leirskole_job_imports")
          .upsert(
            {
              week_id: weekRow.id,
              external_ref: person.external_ref,
              name: name || person.email || person.phone || "Ukjent person",
              email: person.email?.trim() || null,
              phone: person.phone?.trim() || null,
              role_label: person.role_label ?? null,
              max_daily_hours: positiveNumber(person.max_daily_hours, 8),
              source_status: person.employment_status ?? "hired",
              availability,
              linked_leader_id: leaderId,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "week_id,external_ref" },
          );

        if (importError) {
          errors.push(
            `${week.name} / ${
              name || person.external_ref
            }: ${importError.message}`,
          );
          continue;
        }

        if (!leaderId) {
          unmatched.push({
            external_ref: person.external_ref,
            name: name || "Ukjent person",
            email: person.email?.trim() || null,
            phone: person.phone?.trim() || null,
            week: week.name,
          });
          continue;
        }

        const { data: existing } = await admin
          .from("leirskole_staff")
          .select("id")
          .eq("week_id", weekRow.id)
          .eq("leader_id", leaderId)
          .maybeSingle();

        const { error: oldLinkError } = await admin
          .from("leirskole_staff")
          .delete()
          .eq("week_id", weekRow.id)
          .eq("external_ref", person.external_ref)
          .neq("leader_id", leaderId);
        if (oldLinkError) {
          errors.push(`${week.name} / ${name}: ${oldLinkError.message}`);
          continue;
        }

        const { data: staffRow, error: staffError } = await admin
          .from("leirskole_staff")
          .upsert(
            {
              week_id: weekRow.id,
              leader_id: leaderId,
              role_label: person.role_label ?? null,
              max_daily_hours: positiveNumber(person.max_daily_hours, 8),
              external_ref: person.external_ref,
            },
            { onConflict: "week_id,leader_id" },
          )
          .select("id")
          .single();

        if (staffError || !staffRow) {
          errors.push(
            `${week.name} / ${name}: ${
              staffError?.message ?? "kunne ikke lagre bemanningen"
            }`,
          );
          continue;
        }

        if (availability.length) {
          const { error: availabilityError } = await admin
            .from("leirskole_availability")
            .upsert(
              availability.map((row) => ({ ...row, staff_id: staffRow.id })),
              { onConflict: "staff_id,date" },
            );
          if (availabilityError) {
            errors.push(`${week.name} / ${name}: ${availabilityError.message}`);
            continue;
          }
        }

        const { data: savedAvailability, error: savedAvailabilityError } =
          await admin
            .from("leirskole_availability")
            .select("id, date")
            .eq("staff_id", staffRow.id);
        if (savedAvailabilityError) {
          errors.push(
            `${week.name} / ${name}: ${savedAvailabilityError.message}`,
          );
          continue;
        }
        const importedDates = new Set(availability.map((row) => row.date));
        const staleAvailabilityIds = (savedAvailability ?? [])
          .filter((row) => !importedDates.has(row.date))
          .map((row) => row.id);
        if (staleAvailabilityIds.length) {
          const { error: staleAvailabilityError } = await admin
            .from("leirskole_availability")
            .delete()
            .in("id", staleAvailabilityIds);
          if (staleAvailabilityError) {
            errors.push(
              `${week.name} / ${name}: ${staleAvailabilityError.message}`,
            );
            continue;
          }
        }

        linkedByExternalRef.set(person.external_ref, leaderId);
        staffIdByExternalRef.set(person.external_ref, staffRow.id);
        if (existing || matchMethod === "saved") alreadyLinked++;
        else linkedStaff++;
      }

      if (payload.full_snapshot) {
        const { data: importedRows, error: importedRowsError } = await admin
          .from("leirskole_job_imports")
          .select("external_ref")
          .eq("week_id", weekRow.id)
          .or("source_status.is.null,source_status.neq.removed");
        if (importedRowsError) {
          errors.push(`${week.name}: ${importedRowsError.message}`);
          continue;
        }

        const staleRefs = (importedRows ?? [])
          .map((row) => row.external_ref)
          .filter((externalRef) => !activeExternalRefs.has(externalRef));
        if (staleRefs.length) {
          const { data: removedRows, error: removeStaffError } = await admin
            .from("leirskole_staff")
            .delete()
            .eq("week_id", weekRow.id)
            .in("external_ref", staleRefs)
            .select("id");
          if (removeStaffError) {
            errors.push(`${week.name}: ${removeStaffError.message}`);
            continue;
          }

          const { error: markRemovedError } = await admin
            .from("leirskole_job_imports")
            .update({ source_status: "removed" })
            .eq("week_id", weekRow.id)
            .in("external_ref", staleRefs);
          if (markRemovedError) {
            errors.push(`${week.name}: ${markRemovedError.message}`);
            continue;
          }
          removedStaff += removedRows?.length ?? 0;
        }
      }

      const postIdByExternalRef = new Map<string, string>();
      const activePostRefs = new Set<string>();
      for (const post of week.posts ?? []) {
        if (
          !post?.external_ref ||
          !post.name?.trim() ||
          !validDate(post.date) ||
          post.date < week.start_date ||
          post.date > week.end_date ||
          !validTime(post.start_time) ||
          !validTime(post.end_time)
        ) {
          errors.push(`${week.name}: hoppet over en ugyldig vaktpost`);
          continue;
        }

        const postValues = {
          week_id: weekRow.id,
          external_ref: post.external_ref,
          date: post.date,
          name: post.name.trim(),
          post_type: post.post_type?.trim() || "other",
          start_time: post.start_time,
          end_time: post.end_time,
          crosses_midnight: post.crosses_midnight === true,
          required_leaders: integerAtLeast(post.required_leaders, 1, 1),
          is_main_shift: post.is_main_shift === true,
          is_night: post.is_night === true,
          sort_order: integerAtLeast(post.sort_order, 0, 0),
          notes: post.notes ?? null,
        };

        const { data: sourcePost, error: sourcePostError } = await admin
          .from("leirskole_posts")
          .select("id")
          .eq("week_id", weekRow.id)
          .eq("external_ref", post.external_ref)
          .maybeSingle();
        if (sourcePostError) {
          errors.push(
            `${week.name} / ${post.name}: ${sourcePostError.message}`,
          );
          continue;
        }

        let existingPost = sourcePost;
        if (!existingPost) {
          const { data: matchingPosts, error: matchingPostsError } = await admin
            .from("leirskole_posts")
            .select("id")
            .eq("week_id", weekRow.id)
            .is("external_ref", null)
            .eq("date", post.date)
            .eq("name", post.name.trim())
            .eq("start_time", post.start_time)
            .eq("end_time", post.end_time)
            .limit(2);
          if (matchingPostsError) {
            errors.push(
              `${week.name} / ${post.name}: ${matchingPostsError.message}`,
            );
            continue;
          }
          if ((matchingPosts?.length ?? 0) > 1) {
            errors.push(
              `${week.name} / ${post.name}: flere like vaktposter finnes fra før`,
            );
            continue;
          }
          existingPost = matchingPosts?.[0] ?? null;
        }

        const postQuery = existingPost
          ? admin.from("leirskole_posts").update(postValues).eq(
            "id",
            existingPost.id,
          )
          : admin.from("leirskole_posts").insert(postValues);
        const { data: postRow, error: postError } = await postQuery
          .select("id")
          .single();
        if (postError || !postRow) {
          errors.push(
            `${week.name} / ${post.name}: ${
              postError?.message ?? "kunne ikke lagre vaktposten"
            }`,
          );
          continue;
        }

        activePostRefs.add(post.external_ref);
        postIdByExternalRef.set(post.external_ref, postRow.id);
        importedPosts++;
      }

      if (payload.full_snapshot) {
        const { data: importedPostRows, error: importedPostRowsError } =
          await admin
            .from("leirskole_posts")
            .select("id, external_ref")
            .eq("week_id", weekRow.id)
            .not("external_ref", "is", null);
        if (importedPostRowsError) {
          errors.push(`${week.name}: ${importedPostRowsError.message}`);
        } else {
          const stalePostIds = (importedPostRows ?? [])
            .filter((row) =>
              row.external_ref && !activePostRefs.has(row.external_ref)
            )
            .map((row) => row.id);
          if (stalePostIds.length) {
            const { error: stalePostsError } = await admin
              .from("leirskole_posts")
              .delete()
              .in("id", stalePostIds);
            if (stalePostsError) {
              errors.push(`${week.name}: ${stalePostsError.message}`);
            }
          }
        }
      }

      const importedPostIds = [...postIdByExternalRef.values()];
      if (importedPostIds.length) {
        const { data: previousAssignments, error: previousAssignmentsError } =
          await admin
            .from("leirskole_assignments")
            .select("*")
            .in("post_id", importedPostIds);
        if (previousAssignmentsError) {
          errors.push(`${week.name}: ${previousAssignmentsError.message}`);
          continue;
        }

        const nextAssignments = [];
        const assignmentKeys = new Set<string>();
        for (const assignment of week.assignments ?? []) {
          if (
            !assignment?.external_ref || !assignment.post_ref ||
            !assignment.leader_ref
          ) {
            errors.push(`${week.name}: hoppet over en ugyldig vakttildeling`);
            continue;
          }
          const postId = postIdByExternalRef.get(assignment.post_ref);
          if (!postId) {
            errors.push(
              `${week.name}: en vakttildeling peker på en ukjent vaktpost`,
            );
            continue;
          }
          const staffId = staffIdByExternalRef.get(assignment.leader_ref);
          if (!staffId) {
            skippedAssignments++;
            continue;
          }
          const assignmentKey = `${postId}:${staffId}`;
          if (assignmentKeys.has(assignmentKey)) continue;
          assignmentKeys.add(assignmentKey);
          nextAssignments.push({
            external_ref: assignment.external_ref,
            post_id: postId,
            staff_id: staffId,
            is_locked: assignment.is_locked === true,
            assigned_manually: assignment.assigned_manually === true,
            generator_run_id: null,
          });
        }

        const { error: clearAssignmentsError } = await admin
          .from("leirskole_assignments")
          .delete()
          .in("post_id", importedPostIds);
        if (clearAssignmentsError) {
          errors.push(`${week.name}: ${clearAssignmentsError.message}`);
          continue;
        }

        if (nextAssignments.length) {
          const { error: assignmentsError } = await admin
            .from("leirskole_assignments")
            .insert(nextAssignments);
          if (assignmentsError) {
            const { error: restoreError } =
              (previousAssignments?.length ?? 0) > 0
                ? await admin.from("leirskole_assignments").insert(
                  previousAssignments!,
                )
                : { error: null };
            errors.push(
              `${week.name}: ${assignmentsError.message}` +
                (restoreError
                  ? `; tidligere vaktfordeling kunne ikke gjenopprettes: ${restoreError.message}`
                  : ""),
            );
            continue;
          }
          importedAssignments += nextAssignments.length;
        }
      }
    }

    return json({
      weeks: importedWeeks,
      linked: linkedStaff,
      already_linked: alreadyLinked,
      removed: removedStaff,
      posts: importedPosts,
      assignments: importedAssignments,
      skipped_assignments: skippedAssignments,
      unmatched,
      errors,
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Ukjent feil",
    }, 500);
  }
});
