"use client";

/**
 * Luminous – Admin Panel
 * /app/admin/page.tsx  (or wherever you mount it)
 *
 * NOTE: This component expects a GET /api/permissions endpoint that returns
 *       { id, code, name, description }[]. If that route doesn't exist yet,
 *       add a simple handler in your Express router:
 *
 *         router.get("/", requireAuth, async (_req, res) => {
 *           const supabase = createSupabaseAdmin();
 *           const { data, error } = await supabase.from("permissions").select("*").order("code");
 *           if (error) return res.status(500).json({ error: error.message });
 *           res.json(data);
 *         });
 *
 *       Until then the panel degrades gracefully by deriving codes from role data.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REQUIRED_PERMS = [
  "MANAGE_ROLES",
  "ASSIGN_ROLES",
  "MANAGE_EMOJIS",
  "VIEW_AUDIT_LOG",
  "ADMINISTRATOR",
  "PLAY_GOD",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  color: string;
  permissions: Record<string, number>; // 0 deny | 1 inherit | 2 allow
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface PermissionDef {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface UserProfile {
  id: string;
  display_name: string;
  created_at: string;
}

interface UserRoleEntry {
  role: Pick<Role, "id" | "name" | "description" | "priority" | "color" | "is_default">;
  assigned_at: string;
  assigned_by: string;
}

type Tab = "roles" | "members" | "audit";

// ─────────────────────────────────────────────────────────────────────────────
// Permission resolution (mirrors server-side logic in lib/permissions.ts)
// ─────────────────────────────────────────────────────────────────────────────

function resolvePermissions(
    roles: Pick<Role, "priority" | "permissions">[],
    allCodes: string[]
): Record<string, boolean> {
  const sorted = [...roles].sort((a, b) => b.priority - a.priority);
  const resolved: Record<string, boolean> = {};

  for (const code of allCodes) {
    let value: 0 | 2 | undefined;
    for (const role of sorted) {
      const v = role.permissions[code];
      if (v === 2 || v === 0) {
        value = v as 0 | 2;
        break;
      }
    }
    resolved[code] = value === 2;
  }

  if (resolved["ADMINISTRATOR"]) {
    const playGod = resolved["PLAY_GOD"];
    for (const k of Object.keys(resolved)) resolved[k] = true;
    resolved["PLAY_GOD"] = playGod;
  }

  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder audit log
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_AUDIT = [
  { id: 1, action: "ROLE_CREATED",              actor: "SystemAdmin", target: "Moderator",              ts: "2025-03-15T14:23:00Z" },
  { id: 2, action: "ROLE_PERMISSIONS_UPDATED",  actor: "SystemAdmin", target: "Student",                ts: "2025-03-14T09:11:00Z" },
  { id: 3, action: "ROLE_ASSIGNED",             actor: "SystemAdmin", target: "John Doe → Moderator",   ts: "2025-03-13T16:45:00Z" },
  { id: 4, action: "ROLE_REMOVED",              actor: "SystemAdmin", target: "Jane Smith → Guest",     ts: "2025-03-12T11:30:00Z" },
  { id: 5, action: "ROLE_DELETED",              actor: "SystemAdmin", target: "Beta Tester",            ts: "2025-03-11T08:00:00Z" },
  { id: 6, action: "ROLE_REORDERED",            actor: "SystemAdmin", target: "All non-default roles",  ts: "2025-03-10T13:00:00Z" },
  { id: 7, action: "ROLE_ASSIGNED",             actor: "Moderator",   target: "Alex Chen → Student",    ts: "2025-03-09T10:22:00Z" },
  { id: 8, action: "ROLE_CREATED",              actor: "SystemAdmin", target: "Alumni",                 ts: "2025-03-08T15:00:00Z" },
] as const;

const AUDIT_ACTION_STYLE: Record<string, string> = {
  ROLE_CREATED:              "bg-teal/15 text-teal",
  ROLE_DELETED:              "bg-red/15 text-red",
  ROLE_ASSIGNED:             "bg-blue/15 text-blue dark:text-neon-teal",
  ROLE_REMOVED:              "bg-orange-500/15 text-orange-500",
  ROLE_PERMISSIONS_UPDATED:  "bg-yellow-500/15 text-yellow-500",
  ROLE_REORDERED:            "bg-purple-500/15 text-purple-400",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Permission Value Toggle
// ─────────────────────────────────────────────────────────────────────────────

const PERM_STYLES: Record<number, { label: string; cls: string }> = {
  0: { label: "✕  Deny",    cls: "bg-red/20 text-red border-red/40 hover:bg-red/30" },
  1: { label: "—  Inherit", cls: "bg-muted-blue/20 text-muted-blue dark:text-light-muted-blue border-muted-blue/30 dark:border-light-muted-blue/30 hover:bg-muted-blue/30" },
  2: { label: "✓  Allow",   cls: "bg-teal/20 text-teal border-teal/40 hover:bg-teal/30" },
};

function PermToggle({
                      value,
                      onChange,
                      disabled,
                    }: {
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  const { label, cls } = PERM_STYLES[value] ?? PERM_STYLES[1];
  const cycle = () => {
    if (disabled) return;
    onChange(value === 1 ? 2 : value === 2 ? 0 : 1);
  };
  return (
      <button
          type="button"
          onClick={cycle}
          disabled={disabled}
          title={disabled ? "You don't have permission to edit this" : "Click to cycle: Allow → Deny → Inherit"}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors min-w-[88px] text-left ${cls} ${
              disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
          }`}
      >
        {label}
      </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Role Editor
// ─────────────────────────────────────────────────────────────────────────────

interface RoleEdits {
  name: string;
  description: string;
  color: string;
  permissions: Record<string, number>;
}

function RoleEditor({
                      role,
                      edits,
                      setEdits,
                      permDefs,
                      canEdit,
                      canEditPerms,
                      saving,
                      saveError,
                      onSave,
                      onDelete,
                    }: {
  role: Role;
  edits: RoleEdits;
  setEdits: (v: RoleEdits) => void;
  permDefs: PermissionDef[];
  canEdit: boolean;
  canEditPerms: boolean; // PLAY_GOD only
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onDelete: () => void;
}) {
  const identityDisabled = !canEdit || role.is_default;
  const permDisabled = !canEdit || role.is_default;

  const setField = <K extends keyof RoleEdits>(k: K, v: RoleEdits[K]) =>
      setEdits({ ...edits, [k]: v });

  const cyclePermission = (code: string, next: number) =>
      setEdits({ ...edits, permissions: { ...edits.permissions, [code]: next } });

  return (
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
        <span
            className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-beige dark:ring-offset-darker-blue"
            style={{ backgroundColor: role.color, ringColor: role.color }}
        />
          <h2 className="text-xl font-bold truncate">{role.name}</h2>
          {role.is_default && (
              <span className="text-xs bg-muted-blue/20 text-muted-blue dark:text-light-muted-blue px-2 py-0.5 rounded-full">
            @everyone
          </span>
          )}
          {!canEdit && !role.is_default && (
              <span className="text-xs bg-muted-blue/20 text-muted-blue dark:text-light-muted-blue px-2 py-0.5 rounded-full">
            Read-only
          </span>
          )}
          {canEdit && !role.is_default && (
              <button
                  onClick={onDelete}
                  className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-red/40 text-red hover:bg-red/10 transition-colors flex-shrink-0"
              >
                Delete role
              </button>
          )}
        </div>

        {/* ── Identity ── */}
        <section
            className={`rounded-xl border border-muted-blue/20 dark:border-light-muted-blue/10 p-4 transition-opacity ${
                identityDisabled ? "opacity-50" : ""
            }`}
        >
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue mb-3">
            Identity
          </h3>
          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-blue dark:text-light-muted-blue block mb-1">
                  Name
                </label>
                <input
                    className="w-full bg-white/10 dark:bg-black/20 border border-muted-blue/30 dark:border-light-muted-blue/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal disabled:cursor-not-allowed"
                    value={edits.name}
                    onChange={(e) => setField("name", e.target.value)}
                    disabled={identityDisabled}
                    maxLength={32}
                />
              </div>
              <div>
                <label className="text-xs text-muted-blue dark:text-light-muted-blue block mb-1">
                  Description
                </label>
                <input
                    className="w-full bg-white/10 dark:bg-black/20 border border-muted-blue/30 dark:border-light-muted-blue/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal disabled:cursor-not-allowed"
                    value={edits.description}
                    onChange={(e) => setField("description", e.target.value)}
                    disabled={identityDisabled}
                    placeholder="Optional description"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-blue dark:text-light-muted-blue block mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                    type="color"
                    className="w-10 h-10 rounded-lg cursor-pointer border border-muted-blue/30 bg-transparent disabled:cursor-not-allowed"
                    value={edits.color}
                    onChange={(e) => setField("color", e.target.value)}
                    disabled={identityDisabled}
                />
                <input
                    className="w-24 bg-white/10 dark:bg-black/20 border border-muted-blue/30 dark:border-light-muted-blue/20 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-teal disabled:cursor-not-allowed"
                    value={edits.color}
                    onChange={(e) => setField("color", e.target.value)}
                    disabled={identityDisabled}
                    maxLength={7}
                />
              </div>
              <div
                  className="mt-2 h-6 rounded-md border border-muted-blue/20"
                  style={{ backgroundColor: edits.color }}
                  title="Preview"
              />
            </div>
          </div>
        </section>

        {/* ── Permissions ── */}
        <section
            className={`rounded-xl border border-muted-blue/20 dark:border-light-muted-blue/10 overflow-hidden transition-opacity ${
                permDisabled ? "opacity-50" : ""
            }`}
        >
          <div className="px-4 py-3 border-b border-muted-blue/20 dark:border-light-muted-blue/10 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue">
              Permissions
            </h3>
            <span className="text-xs text-muted-blue dark:text-light-muted-blue">
            Click a value to cycle: Allow → Deny → Inherit
          </span>
          </div>

          {permDefs.length === 0 ? (
              <p className="text-sm text-muted-blue dark:text-light-muted-blue text-center py-6">
                No permissions found — make sure <code className="font-mono text-xs bg-black/10 dark:bg-white/10 px-1 rounded">GET /api/permissions</code> is implemented.
              </p>
          ) : (
              <div className="divide-y divide-muted-blue/10 dark:divide-light-muted-blue/5">
                {permDefs.map((perm) => {
                  const val = edits.permissions[perm.code] ?? 1;
                  return (
                      <div
                          key={perm.code}
                          className="flex items-center gap-4 px-4 py-2.5 hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{perm.name || perm.code}</p>
                          {perm.description && (
                              <p className="text-xs text-muted-blue dark:text-light-muted-blue mt-0.5 truncate max-w-lg">
                                {perm.description}
                              </p>
                          )}
                        </div>
                        <PermToggle
                            value={val}
                            onChange={(next) => cyclePermission(perm.code, next)}
                            disabled={permDisabled}
                        />
                      </div>
                  );
                })}
              </div>
          )}
        </section>

        {/* ── Save bar ── */}
        {canEdit && !role.is_default && (
            <div className="flex items-center gap-3">
              <button
                  onClick={onSave}
                  disabled={saving}
                  className="button text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saveError && (
                  <p className="text-sm text-red">{saveError}</p>
              )}
              <p className="text-xs text-muted-blue dark:text-light-muted-blue ml-auto">
                Priority: {role.priority}
              </p>
            </div>
        )}
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Member Role Editor
// ─────────────────────────────────────────────────────────────────────────────

function MemberRoleEditor({
                            user,
                            userRoles,
                            allRoles,
                            myPerms,
                            myHighestPriority,
                            loading,
                            onAssign,
                            onRemove,
                          }: {
  user: UserProfile;
  userRoles: UserRoleEntry[];
  allRoles: Role[];
  myPerms: Record<string, boolean>;
  myHighestPriority: number;
  loading: boolean;
  onAssign: (roleId: string) => void;
  onRemove: (roleId: string) => void;
}) {
  const systemHighest = allRoles
      .filter((r) => !r.is_default)
      .reduce((max, r) => Math.max(max, r.priority), 0);

  const canActOnRole = (priority: number) => {
    if (myPerms["ADMINISTRATOR"] || myPerms["PLAY_GOD"]) return true;
    if (myHighestPriority >= systemHighest) return true;
    return priority < myHighestPriority;
  };

  const assignedIds = new Set(userRoles.map((e) => e.role.id));
  const assignable = allRoles.filter((r) => !r.is_default && !assignedIds.has(r.id));

  return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal/20 flex items-center justify-center text-base font-bold text-teal flex-shrink-0">
            {user.display_name[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.display_name}</h2>
            <p className="text-xs text-muted-blue dark:text-light-muted-blue font-mono truncate">
              {user.id}
            </p>
          </div>
        </div>

        {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
            </div>
        ) : (
            <>
              {/* Current roles */}
              <section className="rounded-xl border border-muted-blue/20 dark:border-light-muted-blue/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-muted-blue/10 dark:border-light-muted-blue/5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue">
                    Assigned Roles
                  </h3>
                </div>
                {userRoles.length === 0 ? (
                    <p className="text-sm text-muted-blue dark:text-light-muted-blue px-4 py-4">
                      No additional roles (only @everyone)
                    </p>
                ) : (
                    <div className="divide-y divide-muted-blue/10 dark:divide-light-muted-blue/5">
                      {userRoles.map((entry) => {
                        const canAct = !entry.role.is_default && canActOnRole(entry.role.priority);
                        return (
                            <div
                                key={entry.role.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 transition-colors"
                            >
                      <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entry.role.color }}
                      />
                              <span className="text-sm font-medium flex-1">{entry.role.name}</span>
                              {entry.role.is_default ? (
                                  <span className="text-xs text-muted-blue dark:text-light-muted-blue">
                          auto-assigned
                        </span>
                              ) : canAct ? (
                                  <button
                                      onClick={() => onRemove(entry.role.id)}
                                      className="text-xs px-2.5 py-1 rounded border border-red/40 text-red hover:bg-red/10 transition-colors"
                                  >
                                    Remove
                                  </button>
                              ) : (
                                  <span className="text-xs text-muted-blue dark:text-light-muted-blue opacity-50">
                          locked
                        </span>
                              )}
                            </div>
                        );
                      })}
                    </div>
                )}
              </section>

              {/* Assign new roles */}
              <section className="rounded-xl border border-muted-blue/20 dark:border-light-muted-blue/10 overflow-hidden">
                <div className="px-4 py-3 border-b border-muted-blue/10 dark:border-light-muted-blue/5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue">
                    Add Role
                  </h3>
                </div>
                {assignable.length === 0 ? (
                    <p className="text-sm text-muted-blue dark:text-light-muted-blue px-4 py-4">
                      All available roles are already assigned
                    </p>
                ) : (
                    <div className="divide-y divide-muted-blue/10 dark:divide-light-muted-blue/5">
                      {assignable
                          .sort((a, b) => b.priority - a.priority)
                          .map((role) => {
                            const canAct = canActOnRole(role.priority);
                            return (
                                <div
                                    key={role.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 ${
                                        !canAct ? "opacity-40" : ""
                                    }`}
                                >
                        <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: role.color }}
                        />
                                  <span className="text-sm font-medium flex-1">{role.name}</span>
                                  <button
                                      onClick={() => canAct && onAssign(role.id)}
                                      disabled={!canAct}
                                      title={!canAct ? "This role outranks you" : undefined}
                                      className="text-xs px-2.5 py-1 rounded border border-teal/40 text-teal hover:bg-teal/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Assign
                                  </button>
                                </div>
                            );
                          })}
                    </div>
                )}
              </section>
            </>
        )}
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Audit Log (placeholder)
// ─────────────────────────────────────────────────────────────────────────────

function AuditLog() {
  return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Audit Log</h2>
            <p className="text-sm text-muted-blue dark:text-light-muted-blue mt-0.5">
              Recent administrative actions across the platform
            </p>
          </div>
          <span className="flex-shrink-0 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30 px-2.5 py-1 rounded-full mt-0.5">
          Placeholder — live log coming soon
        </span>
        </div>

        <div className="rounded-xl border border-muted-blue/20 dark:border-light-muted-blue/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
            <tr className="border-b border-muted-blue/20 dark:border-light-muted-blue/10 bg-muted-blue/5 dark:bg-light-muted-blue/5">
              {["Action", "Actor", "Target", "Timestamp"].map((h) => (
                  <th
                      key={h}
                      className="text-left py-2.5 px-4 text-xs uppercase tracking-widest text-muted-blue dark:text-light-muted-blue font-semibold"
                  >
                    {h}
                  </th>
              ))}
            </tr>
            </thead>
            <tbody>
            {MOCK_AUDIT.map((entry) => (
                <tr
                    key={entry.id}
                    className="border-b border-muted-blue/10 dark:border-light-muted-blue/5 last:border-0 hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 transition-colors"
                >
                  <td className="py-2.5 px-4">
                  <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                          AUDIT_ACTION_STYLE[entry.action] ?? "bg-muted-blue/15 text-muted-blue"
                      }`}
                  >
                    {entry.action}
                  </span>
                  </td>
                  <td className="py-2.5 px-4 text-sm">{entry.actor}</td>
                  <td className="py-2.5 px-4 text-sm text-muted-blue dark:text-light-muted-blue">
                    {entry.target}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-blue dark:text-light-muted-blue tabular-nums">
                    {new Date(entry.ts).toLocaleString()}
                  </td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: New Role Form
// ─────────────────────────────────────────────────────────────────────────────

function NewRoleForm({
                       onCreate,
                       onCancel,
                     }: {
  onCreate: (name: string, color: string, description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1ED2AF");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true);
    setErr(null);
    try {
      await onCreate(name.trim(), color, desc.trim());
    } catch (e: any) {
      setErr(e.message ?? "Failed to create role.");
    } finally {
      setBusy(false);
    }
  };

  return (
      <div className="rounded-xl border border-teal/30 bg-teal/5 p-4 mb-4">
        <h3 className="font-semibold text-sm mb-3">Create New Role</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-blue dark:text-light-muted-blue block mb-1">Name *</label>
            <input
                className="w-full bg-white/10 dark:bg-black/20 border border-muted-blue/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Role name"
                maxLength={32}
                onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-blue dark:text-light-muted-blue block mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                  type="color"
                  className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
              />
              <input
                  className="flex-1 bg-white/10 dark:bg-black/20 border border-muted-blue/30 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-teal"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  maxLength={7}
              />
            </div>
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted-blue dark:text-light-muted-blue block mb-1">Description</label>
          <input
              className="w-full bg-white/10 dark:bg-black/20 border border-muted-blue/30 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
          />
        </div>
        {err && <p className="text-xs text-red mb-2">{err}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={busy} className="button text-sm disabled:opacity-50">
            {busy ? "Creating…" : "Create"}
          </button>
          <button
              onClick={onCancel}
              className="text-sm px-4 py-2 rounded-2xl border border-muted-blue/30 hover:bg-muted-blue/10 dark:hover:bg-light-muted-blue/10 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { session, user } = useAuth() as { session: any; user: any };
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────

  const [roles, setRoles] = useState<Role[]>([]);
  const [permDefs, setPermDefs] = useState<PermissionDef[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [myPerms, setMyPerms] = useState<Record<string, boolean> | null>(null);
  const [myHighestPriority, setMyHighestPriority] = useState(0);

  const [loadState, setLoadState] = useState<"loading" | "denied" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("roles");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleEdits, setRoleEdits] = useState<RoleEdits | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showNewRole, setShowNewRole] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleEntry[]>([]);
  const [loadingUserRoles, setLoadingUserRoles] = useState(false);

  // ── Auth headers ───────────────────────────────────────────────────────────

  const headers = useCallback(
      () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      }),
      [session?.access_token]
  );

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session || !user) return;

    (async () => {
      try {
        // 1. Fetch all roles
        const rolesRes = await fetch(`${API}/api/roles`, { headers: headers() });
        if (!rolesRes.ok) throw new Error("Failed to load roles");
        const rolesData: Role[] = await rolesRes.json();
        setRoles(rolesData);

        // 2. Fetch my roles to resolve my permissions
        const myRolesRes = await fetch(`${API}/api/users/${user.id}/roles`, {
          headers: headers(),
        });
        if (!myRolesRes.ok) throw new Error("Failed to load your roles");
        const myRolesData: UserRoleEntry[] = await myRolesRes.json();
        const myRoleObjs = myRolesData.map((e) => e.role as Role);

        // 3. Fetch permission definitions (falls back to deriving from roles)
        let defs: PermissionDef[] = [];
        try {
          const permRes = await fetch(`${API}/api/permissions`, { headers: headers() });
          if (permRes.ok) defs = await permRes.json();
        } catch {}

        if (defs.length === 0) {
          // Derive from roles — collects all codes currently in use
          const allCodes = new Set<string>();
          rolesData.forEach((r) => Object.keys(r.permissions).forEach((k) => allCodes.add(k)));
          defs = Array.from(allCodes).sort().map((code) => ({
            id: code,
            code,
            name: code
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase()),
            description: null,
          }));
        }
        setPermDefs(defs);

        // 4. Resolve my permissions
        const allCodes = defs.map((d) => d.code);
        const resolved = resolvePermissions(myRoleObjs, allCodes);
        setMyPerms(resolved);

        // 5. Check access
        const hasAccess = REQUIRED_PERMS.some((p) => resolved[p]);
        if (!hasAccess) {
          setLoadState("denied");
          return;
        }

        // 6. Compute my highest role priority
        const highest = myRoleObjs.reduce((max, r) => Math.max(max, r.priority), 0);
        setMyHighestPriority(highest);

        // 7. Load users if able to assign roles
        if (resolved["ASSIGN_ROLES"] || resolved["ADMINISTRATOR"] || resolved["PLAY_GOD"]) {
          try {
            const usersRes = await fetch(`${API}/api/users`, { headers: headers() });
            if (usersRes.ok) setUsers(await usersRes.json());
          } catch {}
        }

        setLoadState("ready");
      } catch (e: any) {
        setLoadError(e.message ?? "Unexpected error");
        setLoadState("error");
      }
    })();
  }, [session, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Role helpers ───────────────────────────────────────────────────────────

  const systemHighestPriority = roles
      .filter((r) => !r.is_default)
      .reduce((max, r) => Math.max(max, r.priority), 0);

  const userIsAtTop =
      myHighestPriority >= systemHighestPriority && systemHighestPriority > 0;

  const canEditRole = (role: Role): boolean => {
    if (!myPerms) return false;
    if (role.is_default) return false;
    if (!myPerms["MANAGE_ROLES"]) return false;
    if (myPerms["ADMINISTRATOR"] || myPerms["PLAY_GOD"]) return true;
    if (userIsAtTop) return true;
    return role.priority < myHighestPriority;
  };

  const selectRole = (role: Role) => {
    setSelectedRole(role);
    setRoleEdits({
      name: role.name,
      description: role.description ?? "",
      color: role.color,
      permissions: { ...role.permissions },
    });
    setSaveError(null);
  };

  const handleSaveRole = async () => {
    if (!selectedRole || !roleEdits) return;
    setSavingRole(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API}/api/roles/${selectedRole.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          name: roleEdits.name,
          description: roleEdits.description || null,
          color: roleEdits.color,
          permissions: roleEdits.permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error); return; }
      setRoles((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      setSelectedRole(data);
    } catch {
      setSaveError("Network error — changes not saved.");
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Permanently delete this role? This will remove it from all users.")) return;
    const res = await fetch(`${API}/api/roles/delete`, {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ roleId }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    if (selectedRole?.id === roleId) setSelectedRole(null);
  };

  const handleCreateRole = async (name: string, color: string, description: string) => {
    const res = await fetch(`${API}/api/roles/new`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name, color, description: description || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setRoles((prev) => [data, ...prev]);
    setShowNewRole(false);
    selectRole(data);
  };

  const moveRole = async (roleId: string, direction: "up" | "down") => {
    // Build current order (highest priority first, no @everyone)
    const ordered = [...roles]
        .filter((r) => !r.is_default)
        .sort((a, b) => b.priority - a.priority);
    const idx = ordered.findIndex((r) => r.id === roleId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
    const res = await fetch(`${API}/api/roles/reorder`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ order: ordered.map((r) => r.id) }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    // Reload to get updated priorities
    const rolesRes = await fetch(`${API}/api/roles`, { headers: headers() });
    if (rolesRes.ok) setRoles(await rolesRes.json());
  };

  // ── Member helpers ─────────────────────────────────────────────────────────

  const handleSelectUser = async (u: UserProfile) => {
    setSelectedUser(u);
    setLoadingUserRoles(true);
    try {
      const res = await fetch(`${API}/api/users/${u.id}/roles`, { headers: headers() });
      if (res.ok) setUserRoles(await res.json());
    } finally {
      setLoadingUserRoles(false);
    }
  };

  const handleAssignRole = async (roleId: string) => {
    if (!selectedUser) return;
    const res = await fetch(`${API}/api/users/${selectedUser.id}/roles/add`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ roleId }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    handleSelectUser(selectedUser);
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedUser) return;
    const res = await fetch(`${API}/api/users/${selectedUser.id}/roles/remove`, {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ roleId }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    handleSelectUser(selectedUser);
  };

  // ── Tab guards ─────────────────────────────────────────────────────────────

  const canManageRoles = !!(myPerms?.["MANAGE_ROLES"] || myPerms?.["ADMINISTRATOR"] || myPerms?.["PLAY_GOD"]);
  const canAssignRoles = !!(myPerms?.["ASSIGN_ROLES"] || myPerms?.["ADMINISTRATOR"] || myPerms?.["PLAY_GOD"]);
  const canViewAudit   = !!(myPerms?.["VIEW_AUDIT_LOG"] || myPerms?.["ADMINISTRATOR"] || myPerms?.["PLAY_GOD"]);

  const sortedRoles = [...roles].sort((a, b) => {
    if (a.is_default) return 1;
    if (b.is_default) return -1;
    return b.priority - a.priority;
  });
  const nonDefaultRoles = sortedRoles.filter((r) => !r.is_default);

  // ── Render: pre-ready states ───────────────────────────────────────────────

  if (!session) {
    return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-blue dark:text-light-muted-blue text-sm">
            Please log in to access this page.
          </p>
        </div>
    );
  }

  if (loadState === "loading") {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-blue dark:text-light-muted-blue">Loading admin panel…</p>
          </div>
        </div>
    );
  }

  if (loadState === "denied") {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-sm px-6">
            <div className="text-5xl mb-4 select-none">🚫</div>
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-sm text-muted-blue dark:text-light-muted-blue mb-5">
              You need at least one of the following permissions to access the admin panel:{" "}
              {REQUIRED_PERMS.map((p, i) => (
                  <span key={p}>
                <code className="font-mono text-xs bg-black/10 dark:bg-white/10 px-1 rounded">{p}</code>
                    {i < REQUIRED_PERMS.length - 1 ? ", " : ""}
              </span>
              ))}
            </p>
            <button onClick={() => router.back()} className="button text-sm">
              Go Back
            </button>
          </div>
        </div>
    );
  }

  if (loadState === "error") {
    return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-sm px-6">
            <div className="text-5xl mb-4 select-none">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-blue dark:text-light-muted-blue mb-5">{loadError}</p>
            <button onClick={() => window.location.reload()} className="button text-sm">
              Retry
            </button>
          </div>
        </div>
    );
  }

  // ── Render: main panel ─────────────────────────────────────────────────────

  return (
      <div className="flex h-full w-full overflow-hidden">
        {/* ── Left sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 flex flex-col border-r border-muted-blue/20 dark:border-light-muted-blue/10 bg-beige/50 dark:bg-darkest-blue/50 overflow-hidden">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-muted-blue/20 dark:border-light-muted-blue/10">
            <h1 className="font-bold text-base">Admin Panel</h1>
            <p className="text-xs text-muted-blue dark:text-light-muted-blue mt-0.5 font-mono">
              Luminous
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-muted-blue/20 dark:border-light-muted-blue/10 flex-shrink-0">
            {(
                [
                  { id: "roles",   label: "Roles",   gated: !canManageRoles && !myPerms?.["MANAGE_EMOJIS"] },
                  { id: "members", label: "Members", gated: !canAssignRoles },
                  { id: "audit",   label: "Audit",   gated: !canViewAudit },
                ] as const
            ).map(({ id, label, gated }) => (
                <button
                    key={id}
                    onClick={() => !gated && setActiveTab(id)}
                    title={gated ? "You don't have the required permission" : undefined}
                    className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2
                ${activeTab === id
                        ? "text-teal border-teal"
                        : "border-transparent text-muted-blue dark:text-light-muted-blue"}
                ${gated
                        ? "opacity-35 cursor-not-allowed"
                        : "hover:text-darker-blue dark:hover:text-offwhite"}
              `}
                >
                  {label}
                </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {/* ── Roles list ── */}
            {activeTab === "roles" && (
                <>
                  {canManageRoles && (
                      <button
                          onClick={() => { setShowNewRole(true); setSelectedRole(null); }}
                          className="w-full mb-2 py-2 px-3 rounded-lg border border-dashed border-teal/40 text-teal text-xs hover:bg-teal/10 transition-colors flex items-center gap-1.5"
                      >
                        <span className="text-base leading-none">+</span>
                        New Role
                      </button>
                  )}

                  {sortedRoles.map((role, i) => {
                    const isSelected = selectedRole?.id === role.id;
                    const orderedNonDefault = nonDefaultRoles;
                    const posInOrdered = orderedNonDefault.findIndex((r) => r.id === role.id);

                    return (
                        <div
                            key={role.id}
                            className={`group flex items-center gap-1 rounded-lg mb-0.5 pr-1 transition-colors
                      ${isSelected
                                ? "bg-teal/15 dark:bg-teal/20"
                                : "hover:bg-muted-blue/10 dark:hover:bg-light-muted-blue/10"}
                    `}
                        >
                          <button
                              onClick={() => selectRole(role)}
                              className="flex-1 flex items-center gap-2 px-2 py-2 text-left min-w-0"
                          >
                      <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: role.color }}
                      />
                            <span className="text-sm truncate">{role.name}</span>
                            {role.is_default && (
                                <span className="ml-auto text-xs text-muted-blue dark:text-light-muted-blue flex-shrink-0">
                          @all
                        </span>
                            )}
                          </button>

                          {/* Reorder arrows — only for non-default roles the user can manage */}
                          {!role.is_default && canManageRoles && (
                              <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => moveRole(role.id, "up")}
                                    disabled={posInOrdered === 0}
                                    className="text-muted-blue dark:text-light-muted-blue hover:text-teal disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none px-0.5"
                                    title="Increase priority"
                                >
                                  ▲
                                </button>
                                <button
                                    onClick={() => moveRole(role.id, "down")}
                                    disabled={posInOrdered === nonDefaultRoles.length - 1}
                                    className="text-muted-blue dark:text-light-muted-blue hover:text-teal disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none px-0.5"
                                    title="Decrease priority"
                                >
                                  ▼
                                </button>
                              </div>
                          )}
                        </div>
                    );
                  })}
                </>
            )}

            {/* ── Members list ── */}
            {activeTab === "members" && (
                <>
                  {users.length === 0 ? (
                      <p className="text-xs text-muted-blue dark:text-light-muted-blue text-center py-4 px-2">
                        No users found
                      </p>
                  ) : (
                      users.map((u) => (
                          <button
                              key={u.id}
                              onClick={() => handleSelectUser(u)}
                              className={`w-full text-left px-2 py-2 rounded-lg mb-0.5 flex items-center gap-2 transition-colors
                      ${selectedUser?.id === u.id
                                  ? "bg-teal/15 dark:bg-teal/20"
                                  : "hover:bg-muted-blue/10 dark:hover:bg-light-muted-blue/10"}
                    `}
                          >
                            <div className="w-7 h-7 rounded-full bg-teal/20 flex items-center justify-center text-xs font-bold text-teal flex-shrink-0">
                              {u.display_name[0]?.toUpperCase()}
                            </div>
                            <span className="text-sm truncate">{u.display_name}</span>
                          </button>
                      ))
                  )}
                </>
            )}

            {/* ── Audit hint ── */}
            {activeTab === "audit" && (
                <p className="text-xs text-muted-blue dark:text-light-muted-blue text-center py-4 px-3 leading-relaxed">
                  The audit log shows recent actions taken in the admin panel.
                </p>
            )}
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6 min-w-0">
          {/* ─ ROLES TAB ─ */}
          {activeTab === "roles" && (
              <>
                {showNewRole && canManageRoles && (
                    <NewRoleForm onCreate={handleCreateRole} onCancel={() => setShowNewRole(false)} />
                )}

                {selectedRole && roleEdits ? (
                    <RoleEditor
                        role={selectedRole}
                        edits={roleEdits}
                        setEdits={setRoleEdits as (v: RoleEdits) => void}
                        permDefs={permDefs}
                        canEdit={canEditRole(selectedRole)}
                        canEditPerms={!!(myPerms?.["PLAY_GOD"])}
                        saving={savingRole}
                        saveError={saveError}
                        onSave={handleSaveRole}
                        onDelete={() => handleDeleteRole(selectedRole.id)}
                    />
                ) : !showNewRole ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center select-none">
                      <div className="text-5xl mb-3">🎭</div>
                      <p className="text-muted-blue dark:text-light-muted-blue text-sm">
                        Select a role from the sidebar to view or edit it
                      </p>
                      {!canManageRoles && (
                          <p className="text-xs text-muted-blue dark:text-light-muted-blue mt-1 opacity-70">
                            (read-only — you don't have MANAGE_ROLES)
                          </p>
                      )}
                    </div>
                ) : null}
              </>
          )}

          {/* ─ MEMBERS TAB ─ */}
          {activeTab === "members" && (
              selectedUser ? (
                  <MemberRoleEditor
                      user={selectedUser}
                      userRoles={userRoles}
                      allRoles={roles}
                      myPerms={myPerms ?? {}}
                      myHighestPriority={myHighestPriority}
                      loading={loadingUserRoles}
                      onAssign={handleAssignRole}
                      onRemove={handleRemoveRole}
                  />
              ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center select-none">
                    <div className="text-5xl mb-3">👥</div>
                    <p className="text-muted-blue dark:text-light-muted-blue text-sm">
                      Select a member from the sidebar to manage their roles
                    </p>
                  </div>
              )
          )}

          {/* ─ AUDIT TAB ─ */}
          {activeTab === "audit" && <AuditLog />}
        </main>
      </div>
  );
}
