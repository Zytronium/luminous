"use client";
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
// Permission resolution
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
      if (v === 2 || v === 0) { value = v as 0 | 2; break; }
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
// Mock audit log
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_AUDIT = [
  { id: 1, action: "ROLE_CREATED",             actor: "SystemAdmin", target: "Moderator",             ts: "2025-03-15T14:23:00Z" },
  { id: 2, action: "ROLE_PERMISSIONS_UPDATED", actor: "SystemAdmin", target: "Student",               ts: "2025-03-14T09:11:00Z" },
  { id: 3, action: "ROLE_ASSIGNED",            actor: "SystemAdmin", target: "John Doe → Moderator",  ts: "2025-03-13T16:45:00Z" },
  { id: 4, action: "ROLE_REMOVED",             actor: "SystemAdmin", target: "Jane Smith → Guest",    ts: "2025-03-12T11:30:00Z" },
  { id: 5, action: "ROLE_DELETED",             actor: "SystemAdmin", target: "Beta Tester",           ts: "2025-03-11T08:00:00Z" },
  { id: 6, action: "ROLE_REORDERED",           actor: "SystemAdmin", target: "All non-default roles", ts: "2025-03-10T13:00:00Z" },
  { id: 7, action: "ROLE_ASSIGNED",            actor: "Moderator",   target: "Alex Chen → Student",   ts: "2025-03-09T10:22:00Z" },
  { id: 8, action: "ROLE_CREATED",             actor: "SystemAdmin", target: "Alumni",                ts: "2025-03-08T15:00:00Z" },
] as const;

const AUDIT_ACTION_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  ROLE_CREATED:             { bg: "bg-teal/10",           text: "text-teal",          dot: "bg-teal" },
  ROLE_DELETED:             { bg: "bg-red/10",            text: "text-red",           dot: "bg-red" },
  ROLE_ASSIGNED:            { bg: "bg-blue/10",           text: "text-blue dark:text-neon-teal", dot: "bg-blue dark:bg-neon-teal" },
  ROLE_REMOVED:             { bg: "bg-orange-500/10",     text: "text-orange-500",    dot: "bg-orange-500" },
  ROLE_PERMISSIONS_UPDATED: { bg: "bg-yellow-500/10",     text: "text-yellow-500",    dot: "bg-yellow-500" },
  ROLE_REORDERED:           { bg: "bg-purple-500/10",     text: "text-purple-400",    dot: "bg-purple-400" },
};

// ─────────────────────────────────────────────────────────────────────────────
// PermToggle
// ─────────────────────────────────────────────────────────────────────────────

const PERM_STYLES: Record<number, { label: string; cls: string }> = {
  0: { label: "✕  Deny",    cls: "bg-red/20 text-red border-red/40 hover:bg-red/30" },
  1: { label: "—  Inherit", cls: "bg-muted-blue/20 text-muted-blue dark:text-light-muted-blue border-muted-blue/30 dark:border-light-muted-blue/30 hover:bg-muted-blue/30" },
  2: { label: "✓  Allow",   cls: "bg-teal/20 text-teal border-teal/40 hover:bg-teal/30" },
};

function PermToggle({ value, onChange, disabled }: {
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  const { label, cls } = PERM_STYLES[value] ?? PERM_STYLES[1];
  return (
      <button
          type="button"
          onClick={() => { if (!disabled) onChange(value === 1 ? 2 : value === 2 ? 0 : 1); }}
          disabled={disabled}
          title={disabled ? "You don't have permission to edit this" : "Click to cycle: Allow → Deny → Inherit"}
          className={`px-3 py-1 rounded text-xs font-semibold border transition-colors min-w-[92px] text-left ${cls} ${
              disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
          }`}
      >
        {label}
      </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleEditor — redesigned Discord-style
// ─────────────────────────────────────────────────────────────────────────────

interface RoleEdits {
  name: string;
  description: string;
  color: string;
  permissions: Record<string, number>;
}

function RoleEditor({
                      role, edits, setEdits, permDefs,
                      canEdit, canEditPerms, saving, saveError, onSave, onDelete,
                    }: {
  role: Role;
  edits: RoleEdits;
  setEdits: (v: RoleEdits) => void;
  permDefs: PermissionDef[];
  canEdit: boolean;
  canEditPerms: boolean;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onDelete: () => void;
}) {
  const identityDisabled = !canEdit || role.is_default;
  const permDisabled     = !canEdit || role.is_default;

  const setField = <K extends keyof RoleEdits>(k: K, v: RoleEdits[K]) =>
      setEdits({ ...edits, [k]: v });

  const cyclePermission = (code: string, next: number) =>
      setEdits({ ...edits, permissions: { ...edits.permissions, [code]: next } });

  return (
      <div className="flex flex-col h-full min-h-0">
        {/* ── Sticky header ── */}
        <div className="flex-shrink-0 px-8 pt-8 pb-5 border-b border-muted-blue/15 dark:border-light-muted-blue/10">
          <div className="flex items-center gap-3">
          <span
              className="w-6 h-6 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-beige dark:ring-offset-darker-blue"
              style={{ backgroundColor: role.color, ringColor: role.color }}
          />
            <h2 className="text-xl font-bold tracking-tight">{role.name}</h2>
            {role.is_default && (
                <span className="text-[10px] font-semibold uppercase tracking-widest bg-muted-blue/15 text-muted-blue dark:text-light-muted-blue px-2 py-0.5 rounded-full">
              @everyone
            </span>
            )}
            {!canEdit && !role.is_default && (
                <span className="text-[10px] font-semibold uppercase tracking-widest bg-muted-blue/15 text-muted-blue dark:text-light-muted-blue px-2 py-0.5 rounded-full">
              Read-only
            </span>
            )}
            {canEdit && !role.is_default && (
                <button
                    onClick={onDelete}
                    className="ml-auto text-xs px-3 py-1.5 rounded-md border border-red/30 text-red hover:bg-red/10 transition-colors"
                >
                  Delete Role
                </button>
            )}
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 min-h-0">

          {/* DISPLAY section */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue mb-3">
              Display
            </h3>
            <div className={`rounded-lg border border-muted-blue/15 dark:border-light-muted-blue/10 bg-beige/40 dark:bg-darkest-blue/40 overflow-hidden transition-opacity ${identityDisabled ? "opacity-50" : ""}`}>
              <div className="p-5 grid grid-cols-[1fr_auto] gap-6 items-start">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-blue dark:text-light-muted-blue mb-1.5 uppercase tracking-wider">
                      Role Name
                    </label>
                    <input
                        className="w-full bg-white/60 dark:bg-black/30 border border-muted-blue/25 dark:border-light-muted-blue/15 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal disabled:cursor-not-allowed transition-colors"
                        value={edits.name}
                        onChange={(e) => setField("name", e.target.value)}
                        disabled={identityDisabled}
                        maxLength={32}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-blue dark:text-light-muted-blue mb-1.5 uppercase tracking-wider">
                      Description
                    </label>
                    <input
                        className="w-full bg-white/60 dark:bg-black/30 border border-muted-blue/25 dark:border-light-muted-blue/15 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal disabled:cursor-not-allowed transition-colors"
                        value={edits.description}
                        onChange={(e) => setField("description", e.target.value)}
                        disabled={identityDisabled}
                        placeholder="Optional description"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-blue dark:text-light-muted-blue mb-1.5 uppercase tracking-wider">
                    Color
                  </label>
                  <div className="flex flex-col items-center gap-2">
                    <input
                        type="color"
                        className="w-12 h-12 rounded-lg cursor-pointer border border-muted-blue/20 bg-transparent disabled:cursor-not-allowed"
                        value={edits.color}
                        onChange={(e) => setField("color", e.target.value)}
                        disabled={identityDisabled}
                    />
                    <input
                        className="w-20 bg-white/60 dark:bg-black/30 border border-muted-blue/25 dark:border-light-muted-blue/15 rounded-md px-2 py-1 text-[11px] font-mono text-center focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed transition-colors"
                        value={edits.color}
                        onChange={(e) => setField("color", e.target.value)}
                        disabled={identityDisabled}
                        maxLength={7}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PERMISSIONS section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue">
                Permissions
              </h3>
              <span className="text-[10px] text-muted-blue dark:text-light-muted-blue opacity-70">
              Click to cycle: Allow → Deny → Inherit
            </span>
            </div>

            <div className={`rounded-lg border border-muted-blue/15 dark:border-light-muted-blue/10 overflow-hidden transition-opacity ${permDisabled ? "opacity-50" : ""}`}>
              {permDefs.length === 0 ? (
                  <p className="text-sm text-muted-blue dark:text-light-muted-blue text-center py-8">
                    No permissions found — make sure{" "}
                    <code className="font-mono text-xs bg-black/10 dark:bg-white/10 px-1 rounded">
                      GET /api/permissions
                    </code>{" "}
                    is implemented.
                  </p>
              ) : (
                  <div className="divide-y divide-muted-blue/8 dark:divide-light-muted-blue/5">
                    {permDefs.map((perm, i) => {
                      const val = edits.permissions[perm.code] ?? 1;
                      return (
                          <div
                              key={perm.code}
                              className={`flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 ${i % 2 === 0 ? "" : "bg-muted-blue/[0.02] dark:bg-light-muted-blue/[0.02]"}`}
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
            </div>
          </div>

          {/* Bottom padding */}
          <div className="h-4" />
        </div>

        {/* ── Sticky save bar ── */}
        {canEdit && !role.is_default && (
            <div className="flex-shrink-0 px-8 py-4 border-t border-muted-blue/15 dark:border-light-muted-blue/10 bg-beige/60 dark:bg-darkest-blue/60 backdrop-blur-sm flex items-center gap-3">
              <button
                  onClick={onSave}
                  disabled={saving}
                  className="button text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              {saveError && <p className="text-sm text-red">{saveError}</p>}
              <p className="text-xs text-muted-blue dark:text-light-muted-blue ml-auto">
                Priority: {role.priority}
              </p>
            </div>
        )}
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MemberRoleEditor — redesigned Discord-style
// ─────────────────────────────────────────────────────────────────────────────

function MemberRoleEditor({
                            user, userRoles, allRoles, myPerms, myHighestPriority, loading, onAssign, onRemove,
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
  const assignable  = allRoles.filter((r) => !r.is_default && !assignedIds.has(r.id));

  return (
      <div className="flex flex-col h-full min-h-0">
        {/* ── Sticky header ── */}
        <div className="flex-shrink-0 px-8 pt-8 pb-5 border-b border-muted-blue/15 dark:border-light-muted-blue/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal/20 flex items-center justify-center text-lg font-bold text-teal flex-shrink-0">
              {user.display_name[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{user.display_name}</h2>
              <p className="text-xs text-muted-blue dark:text-light-muted-blue font-mono mt-0.5 truncate">
                {user.id}
              </p>
            </div>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 min-h-0">
          {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
              </div>
          ) : (
              <>
                {/* Assigned Roles */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue mb-3">
                    Assigned Roles — {userRoles.length}
                  </h3>
                  <div className="rounded-lg border border-muted-blue/15 dark:border-light-muted-blue/10 overflow-hidden">
                    {userRoles.length === 0 ? (
                        <p className="text-sm text-muted-blue dark:text-light-muted-blue px-5 py-5">
                          No additional roles — only @everyone
                        </p>
                    ) : (
                        <div className="divide-y divide-muted-blue/8 dark:divide-light-muted-blue/5">
                          {userRoles.map((entry) => {
                            const canAct = !entry.role.is_default && canActOnRole(entry.role.priority);
                            return (
                                <div key={entry.role.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 transition-colors">
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.role.color }} />
                                  <span className="text-sm font-medium flex-1">{entry.role.name}</span>
                                  {entry.role.is_default ? (
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-blue dark:text-light-muted-blue bg-muted-blue/10 px-2 py-0.5 rounded">
                              auto
                            </span>
                                  ) : canAct ? (
                                      <button
                                          onClick={() => onRemove(entry.role.id)}
                                          className="text-xs px-2.5 py-1 rounded border border-red/30 text-red hover:bg-red/10 transition-colors"
                                      >
                                        Remove
                                      </button>
                                  ) : (
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-blue dark:text-light-muted-blue bg-muted-blue/10 px-2 py-0.5 rounded">
                              locked
                            </span>
                                  )}
                                </div>
                            );
                          })}
                        </div>
                    )}
                  </div>
                </div>

                {/* Add Role */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue mb-3">
                    Add Role
                  </h3>
                  <div className="rounded-lg border border-muted-blue/15 dark:border-light-muted-blue/10 overflow-hidden">
                    {assignable.length === 0 ? (
                        <p className="text-sm text-muted-blue dark:text-light-muted-blue px-5 py-5">
                          All available roles are already assigned
                        </p>
                    ) : (
                        <div className="divide-y divide-muted-blue/8 dark:divide-light-muted-blue/5">
                          {assignable
                              .sort((a, b) => b.priority - a.priority)
                              .map((role) => {
                                const canAct = canActOnRole(role.priority);
                                return (
                                    <div
                                        key={role.id}
                                        className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 ${!canAct ? "opacity-40" : ""}`}
                                    >
                                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                                      <span className="text-sm font-medium flex-1">{role.name}</span>
                                      <button
                                          onClick={() => canAct && onAssign(role.id)}
                                          disabled={!canAct}
                                          title={!canAct ? "This role outranks you" : undefined}
                                          className="text-xs px-2.5 py-1 rounded border border-teal/40 text-teal hover:bg-teal/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Add
                                      </button>
                                    </div>
                                );
                              })}
                        </div>
                    )}
                  </div>
                </div>
              </>
          )}
          <div className="h-4" />
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuditLog — redesigned Discord-style
// ─────────────────────────────────────────────────────────────────────────────

function AuditLog() {
  return (
      <div className="flex flex-col h-full min-h-0">
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-8 pt-8 pb-5 border-b border-muted-blue/15 dark:border-light-muted-blue/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Audit Log</h2>
              <p className="text-sm text-muted-blue dark:text-light-muted-blue mt-0.5">
                Recent administrative actions across the platform
              </p>
            </div>
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25 px-2.5 py-1 rounded">
            Placeholder
          </span>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
          <div className="rounded-lg border border-muted-blue/15 dark:border-light-muted-blue/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
              <tr className="border-b border-muted-blue/15 dark:border-light-muted-blue/10 bg-muted-blue/5 dark:bg-light-muted-blue/5">
                {["Action", "Actor", "Target", "Timestamp"].map((h) => (
                    <th key={h} className="text-left py-3 px-5 text-[10px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue">
                      {h}
                    </th>
                ))}
              </tr>
              </thead>
              <tbody>
              {MOCK_AUDIT.map((entry) => {
                const style = AUDIT_ACTION_STYLE[entry.action];
                return (
                    <tr
                        key={entry.id}
                        className="border-b border-muted-blue/8 dark:border-light-muted-blue/5 last:border-0 hover:bg-muted-blue/5 dark:hover:bg-light-muted-blue/5 transition-colors"
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          {style && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />}
                          <span className={`text-xs font-mono font-semibold ${style?.text ?? "text-muted-blue"}`}>
                          {entry.action}
                        </span>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-sm font-medium">{entry.actor}</td>
                      <td className="py-3 px-5 text-sm text-muted-blue dark:text-light-muted-blue">{entry.target}</td>
                      <td className="py-3 px-5 text-xs text-muted-blue dark:text-light-muted-blue tabular-nums">
                        {new Date(entry.ts).toLocaleString()}
                      </td>
                    </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NewRoleForm — redesigned Discord-style
// ─────────────────────────────────────────────────────────────────────────────

function NewRoleForm({ onCreate, onCancel }: {
  onCreate: (name: string, color: string, description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,  setName]  = useState("");
  const [color, setColor] = useState("#1ED2AF");
  const [desc,  setDesc]  = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) { setErr("Name is required."); return; }
    setBusy(true); setErr(null);
    try { await onCreate(name.trim(), color, desc.trim()); }
    catch (e: any) { setErr(e.message ?? "Failed to create role."); }
    finally { setBusy(false); }
  };

  return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-shrink-0 px-8 pt-8 pb-5 border-b border-muted-blue/15 dark:border-light-muted-blue/10">
          <h2 className="text-xl font-bold tracking-tight">Create New Role</h2>
          <p className="text-sm text-muted-blue dark:text-light-muted-blue mt-0.5">
            Configure the new role's identity and permissions after creation.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
          <div className="max-w-lg space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue mb-1.5">
                Role Name <span className="text-red">*</span>
              </label>
              <input
                  className="w-full bg-white/60 dark:bg-black/30 border border-muted-blue/25 dark:border-light-muted-blue/15 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Moderator"
                  maxLength={32}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue mb-1.5">
                Description
              </label>
              <input
                  className="w-full bg-white/60 dark:bg-black/30 border border-muted-blue/25 dark:border-light-muted-blue/15 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal focus:border-teal transition-colors"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Optional description"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue mb-1.5">
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                    type="color"
                    className="w-10 h-10 rounded-lg cursor-pointer border border-muted-blue/20 bg-transparent"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                />
                <input
                    className="w-28 bg-white/60 dark:bg-black/30 border border-muted-blue/25 dark:border-light-muted-blue/15 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal transition-colors"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    maxLength={7}
                />
                <div className="w-10 h-10 rounded-lg border border-muted-blue/20" style={{ backgroundColor: color }} />
              </div>
            </div>

            {err && <p className="text-sm text-red">{err}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={submit} disabled={busy} className="button text-sm disabled:opacity-50">
                {busy ? "Creating…" : "Create Role"}
              </button>
              <button
                  onClick={onCancel}
                  className="text-sm px-4 py-2 rounded-2xl border border-muted-blue/30 hover:bg-muted-blue/10 dark:hover:bg-light-muted-blue/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav item icons (inline SVG for zero dependency)
// ─────────────────────────────────────────────────────────────────────────────

function IconShield({ className }: { className?: string }) {
  return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
      </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
  );
}

function IconLog({ className }: { className?: string }) {
  return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h7a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { session, user } = useAuth() as { session: any; user: any };
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────

  const [roles,             setRoles]             = useState<Role[]>([]);
  const [permDefs,          setPermDefs]           = useState<PermissionDef[]>([]);
  const [users,             setUsers]              = useState<UserProfile[]>([]);
  const [myPerms,           setMyPerms]            = useState<Record<string, boolean> | null>(null);
  const [myHighestPriority, setMyHighestPriority]  = useState(0);

  const [loadState, setLoadState] = useState<"loading" | "denied" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab,    setActiveTab]    = useState<Tab>("roles");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleEdits,    setRoleEdits]    = useState<RoleEdits | null>(null);
  const [savingRole,   setSavingRole]   = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [showNewRole,  setShowNewRole]  = useState(false);

  const [selectedUser,    setSelectedUser]    = useState<UserProfile | null>(null);
  const [userRoles,       setUserRoles]       = useState<UserRoleEntry[]>([]);
  const [loadingUserRoles,setLoadingUserRoles]= useState(false);

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
        const rolesRes  = await fetch(`${API}/api/roles`, { headers: headers() });
        if (!rolesRes.ok) throw new Error("Failed to load roles");
        const rolesData: Role[] = await rolesRes.json();
        setRoles(rolesData);

        const myRolesRes = await fetch(`${API}/api/users/${user.id}/roles`, { headers: headers() });
        if (!myRolesRes.ok) throw new Error("Failed to load your roles");
        const myRolesData: UserRoleEntry[] = await myRolesRes.json();
        const myRoleObjs = myRolesData.map((e) => e.role as Role);

        let defs: PermissionDef[] = [];
        try {
          const permRes = await fetch(`${API}/api/permissions`, { headers: headers() });
          if (permRes.ok) defs = await permRes.json();
        } catch {}

        if (defs.length === 0) {
          const allCodes = new Set<string>();
          rolesData.forEach((r) => Object.keys(r.permissions).forEach((k) => allCodes.add(k)));
          defs = Array.from(allCodes).sort().map((code) => ({
            id: code, code,
            name: code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
            description: null,
          }));
        }
        setPermDefs(defs);

        const allCodes = defs.map((d) => d.code);
        const resolved = resolvePermissions(myRoleObjs, allCodes);
        setMyPerms(resolved);

        const hasAccess = REQUIRED_PERMS.some((p) => resolved[p]);
        if (!hasAccess) { setLoadState("denied"); return; }

        const highest = myRoleObjs.reduce((max, r) => Math.max(max, r.priority), 0);
        setMyHighestPriority(highest);

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
    setRoleEdits({ name: role.name, description: role.description ?? "", color: role.color, permissions: { ...role.permissions } });
    setSaveError(null);
  };

  const handleSaveRole = async () => {
    if (!selectedRole || !roleEdits) return;
    setSavingRole(true); setSaveError(null);
    try {
      const res  = await fetch(`${API}/api/roles/${selectedRole.id}`, {
        method: "PATCH", headers: headers(),
        body: JSON.stringify({ name: roleEdits.name, description: roleEdits.description || null, color: roleEdits.color, permissions: roleEdits.permissions }),
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
      method: "DELETE", headers: headers(), body: JSON.stringify({ roleId }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
    if (selectedRole?.id === roleId) setSelectedRole(null);
  };

  const handleCreateRole = async (name: string, color: string, description: string) => {
    const res  = await fetch(`${API}/api/roles/new`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ name, color, description: description || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setRoles((prev) => [data, ...prev]);
    setShowNewRole(false);
    selectRole(data);
  };

  const moveRole = async (roleId: string, direction: "up" | "down") => {
    const ordered = [...roles].filter((r) => !r.is_default).sort((a, b) => b.priority - a.priority);
    const idx     = ordered.findIndex((r) => r.id === roleId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
    const res = await fetch(`${API}/api/roles/reorder`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ order: ordered.map((r) => r.id) }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    const rolesRes = await fetch(`${API}/api/roles`, { headers: headers() });
    if (rolesRes.ok) setRoles(await rolesRes.json());
  };

  // ── Member helpers ─────────────────────────────────────────────────────────

  const handleSelectUser = async (u: UserProfile) => {
    setSelectedUser(u); setLoadingUserRoles(true);
    try {
      const res = await fetch(`${API}/api/users/${u.id}/roles`, { headers: headers() });
      if (res.ok) setUserRoles(await res.json());
    } finally { setLoadingUserRoles(false); }
  };

  const handleAssignRole = async (roleId: string) => {
    if (!selectedUser) return;
    const res = await fetch(`${API}/api/users/${selectedUser.id}/roles/add`, {
      method: "POST", headers: headers(), body: JSON.stringify({ roleId }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    handleSelectUser(selectedUser);
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!selectedUser) return;
    const res = await fetch(`${API}/api/users/${selectedUser.id}/roles/remove`, {
      method: "DELETE", headers: headers(), body: JSON.stringify({ roleId }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    handleSelectUser(selectedUser);
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const canManageRoles = !!(myPerms?.["MANAGE_ROLES"] || myPerms?.["ADMINISTRATOR"] || myPerms?.["PLAY_GOD"]);
  const canAssignRoles = !!(myPerms?.["ASSIGN_ROLES"]  || myPerms?.["ADMINISTRATOR"] || myPerms?.["PLAY_GOD"]);
  const canViewAudit   = !!(myPerms?.["VIEW_AUDIT_LOG"]|| myPerms?.["ADMINISTRATOR"] || myPerms?.["PLAY_GOD"]);

  const sortedRoles    = [...roles].sort((a, b) => {
    if (a.is_default) return 1;
    if (b.is_default) return -1;
    return b.priority - a.priority;
  });
  const nonDefaultRoles = sortedRoles.filter((r) => !r.is_default);

  // ── Pre-ready states ───────────────────────────────────────────────────────

  if (!session) router.replace("/auth");

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
              You need at least one of:{" "}
              {REQUIRED_PERMS.map((p, i) => (
                  <span key={p}>
                <code className="font-mono text-xs bg-black/10 dark:bg-white/10 px-1 rounded">{p}</code>
                    {i < REQUIRED_PERMS.length - 1 ? ", " : ""}
              </span>
              ))}
            </p>
            <button onClick={() => router.back()} className="button text-sm">Go Back</button>
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
            <button onClick={() => window.location.reload()} className="button text-sm">Retry</button>
          </div>
        </div>
    );
  }

  // ── Nav items ──────────────────────────────────────────────────────────────

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode; gated: boolean }[] = [
    {
      id: "roles",
      label: "Roles",
      icon: <IconShield className="w-4 h-4" />,
      gated: !canManageRoles && !myPerms?.["MANAGE_EMOJIS"],
    },
    {
      id: "members",
      label: "Members",
      icon: <IconUsers className="w-4 h-4" />,
      gated: !canAssignRoles,
    },
    {
      id: "audit",
      label: "Audit Log",
      icon: <IconLog className="w-4 h-4" />,
      gated: !canViewAudit,
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — Discord-style three-panel layout
  //
  //  [Settings Nav 200px] [List Panel 260px] [Detail Panel flex-1]
  //
  // For "audit" tab the list panel is hidden and detail spans full width.
  // ─────────────────────────────────────────────────────────────────────────

  const isAuditTab = activeTab === "audit";

  return (
      <div className="flex h-full w-full overflow-hidden">

        {/* ══ PANEL 1 — Settings Navigation ══════════════════════════════════ */}
        <nav className="w-[200px] flex-shrink-0 flex flex-col border-r border-muted-blue/15 dark:border-light-muted-blue/10 bg-beige/60 dark:bg-darkest-blue/60 overflow-hidden">

          {/* Server name header */}
          <div className="px-4 py-4 border-b border-muted-blue/15 dark:border-light-muted-blue/10 flex-shrink-0">
            <h1 className="font-bold text-sm truncate">Luminous</h1>
            <p className="text-[10px] text-muted-blue dark:text-light-muted-blue mt-0.5 uppercase tracking-widest">
              Admin Panel
            </p>
          </div>

          {/* Nav section */}
          <div className="flex-1 overflow-y-auto py-3 px-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue dark:text-light-muted-blue px-2 mb-1">
              Server Settings
            </p>
            <div className="space-y-0.5">
              {NAV_ITEMS.map(({ id, label, icon, gated }) => {
                const isActive = activeTab === id;
                return (
                    <button
                        key={id}
                        onClick={() => !gated && setActiveTab(id)}
                        disabled={gated}
                        title={gated ? "You don't have the required permission" : undefined}
                        className={`
                    w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors text-left
                    ${isActive
                            ? "bg-teal/15 dark:bg-teal/20 text-darker-blue dark:text-offwhite"
                            : gated
                                ? "opacity-35 cursor-not-allowed text-muted-blue dark:text-light-muted-blue"
                                : "text-muted-blue dark:text-light-muted-blue hover:bg-muted-blue/10 dark:hover:bg-light-muted-blue/10 hover:text-darker-blue dark:hover:text-offwhite"
                        }
                  `}
                    >
                      <span className={isActive ? "text-teal" : ""}>{icon}</span>
                      {label}
                    </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* ══ PANEL 2 — Context List (hidden for audit tab) ══════════════════ */}
        {!isAuditTab && (
            <div className="w-[260px] flex-shrink-0 flex flex-col border-r border-muted-blue/15 dark:border-light-muted-blue/10 bg-beige/30 dark:bg-darker-blue/30 overflow-hidden">

              {/* ── Roles List ── */}
              {activeTab === "roles" && (
                  <>
                    <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-muted-blue/15 dark:border-light-muted-blue/10">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold">Roles</h2>
                        <span className="text-[10px] text-muted-blue dark:text-light-muted-blue bg-muted-blue/10 px-1.5 py-0.5 rounded font-semibold">
                    {sortedRoles.length}
                  </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
                      {canManageRoles && (
                          <button
                              onClick={() => { setShowNewRole(true); setSelectedRole(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-dashed border-teal/40 text-teal text-xs hover:bg-teal/10 transition-colors mb-2"
                          >
                            <span className="text-base leading-none font-bold">+</span>
                            Create New Role
                          </button>
                      )}

                      {sortedRoles.map((role) => {
                        const isSelected = !showNewRole && selectedRole?.id === role.id;
                        const posInOrdered = nonDefaultRoles.findIndex((r) => r.id === role.id);

                        return (
                            <div
                                key={role.id}
                                className={`group flex items-center gap-1 rounded-md transition-colors
                        ${isSelected
                                    ? "bg-teal/15 dark:bg-teal/20"
                                    : "hover:bg-muted-blue/10 dark:hover:bg-light-muted-blue/10"
                                }`}
                            >
                              <button
                                  onClick={() => { setShowNewRole(false); selectRole(role); }}
                                  className="flex-1 flex items-center gap-2.5 px-2.5 py-2 text-left min-w-0"
                              >
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                                <span className="text-sm truncate">{role.name}</span>
                                {role.is_default && (
                                    <span className="ml-auto text-[10px] text-muted-blue dark:text-light-muted-blue flex-shrink-0 font-semibold">
                            @all
                          </span>
                                )}
                              </button>

                              {!role.is_default && canManageRoles && (
                                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                    <button
                                        onClick={() => moveRole(role.id, "up")}
                                        disabled={posInOrdered === 0}
                                        className="text-muted-blue dark:text-light-muted-blue hover:text-teal disabled:opacity-20 disabled:cursor-not-allowed text-[10px] leading-none px-0.5"
                                        title="Increase priority"
                                    >▲</button>
                                    <button
                                        onClick={() => moveRole(role.id, "down")}
                                        disabled={posInOrdered === nonDefaultRoles.length - 1}
                                        className="text-muted-blue dark:text-light-muted-blue hover:text-teal disabled:opacity-20 disabled:cursor-not-allowed text-[10px] leading-none px-0.5"
                                        title="Decrease priority"
                                    >▼</button>
                                  </div>
                              )}
                            </div>
                        );
                      })}
                    </div>
                  </>
              )}

              {/* ── Members List ── */}
              {activeTab === "members" && (
                  <>
                    <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-muted-blue/15 dark:border-light-muted-blue/10">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold">Members</h2>
                        <span className="text-[10px] text-muted-blue dark:text-light-muted-blue bg-muted-blue/10 px-1.5 py-0.5 rounded font-semibold">
                    {users.length}
                  </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
                      {users.length === 0 ? (
                          <p className="text-xs text-muted-blue dark:text-light-muted-blue text-center py-6 px-3">
                            No users found
                          </p>
                      ) : (
                          users.map((u) => (
                              <button
                                  key={u.id}
                                  onClick={() => handleSelectUser(u)}
                                  className={`w-full text-left px-2.5 py-2 rounded-md flex items-center gap-2.5 transition-colors
                        ${selectedUser?.id === u.id
                                      ? "bg-teal/15 dark:bg-teal/20"
                                      : "hover:bg-muted-blue/10 dark:hover:bg-light-muted-blue/10"
                                  }`}
                              >
                                <div className="w-7 h-7 rounded-full bg-teal/20 flex items-center justify-center text-xs font-bold text-teal flex-shrink-0">
                                  {u.display_name[0]?.toUpperCase()}
                                </div>
                                <span className="text-sm truncate">{u.display_name}</span>
                              </button>
                          ))
                      )}
                    </div>
                  </>
              )}
            </div>
        )}

        {/* ══ PANEL 3 — Detail / Editor ══════════════════════════════════════ */}
        <main className="flex-1 overflow-hidden min-w-0 bg-beige/10 dark:bg-darker-blue/20">

          {/* ── Roles tab detail ── */}
          {activeTab === "roles" && (
              <>
                {showNewRole && canManageRoles ? (
                    <NewRoleForm onCreate={handleCreateRole} onCancel={() => setShowNewRole(false)} />
                ) : selectedRole && roleEdits ? (
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
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center select-none px-8">
                      <div className="text-5xl mb-4">🎭</div>
                      <p className="text-base font-semibold mb-1">No Role Selected</p>
                      <p className="text-sm text-muted-blue dark:text-light-muted-blue max-w-xs">
                        Select a role from the list to view or edit its settings and permissions.
                      </p>
                      {!canManageRoles && (
                          <p className="text-xs text-muted-blue dark:text-light-muted-blue mt-2 opacity-60">
                            Read-only — you don't have MANAGE_ROLES
                          </p>
                      )}
                    </div>
                )}
              </>
          )}

          {/* ── Members tab detail ── */}
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
                  <div className="flex flex-col items-center justify-center h-full text-center select-none px-8">
                    <div className="text-5xl mb-4">👥</div>
                    <p className="text-base font-semibold mb-1">No Member Selected</p>
                    <p className="text-sm text-muted-blue dark:text-light-muted-blue max-w-xs">
                      Select a member from the list to manage their assigned roles.
                    </p>
                  </div>
              )
          )}

          {/* ── Audit tab detail ── */}
          {activeTab === "audit" && <AuditLog />}
        </main>
      </div>
  );
}
