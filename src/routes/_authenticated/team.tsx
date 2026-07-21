import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Copy, Mail, Shield, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandLockup } from "@/components/brand-mark";
import {
  createInvitation,
  listMyWorkspaces,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from "@/lib/team.functions";

const ROLES = ["owner", "admin", "member", "viewer"] as const;
type Role = (typeof ROLES)[number];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control, billing, and can delete the workspace.",
  admin: "Manage members, integrations, and settings.",
  member: "Operate recovery campaigns and integrations.",
  viewer: "Read-only access to analytics and events.",
};

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [{ title: "Team — RRLabs" }, { name: "robots", content: "noindex" }],
  }),
  component: TeamPage,
});

function TeamPage() {
  const qc = useQueryClient();

  const workspacesFn = useServerFn(listMyWorkspaces);
  const membersFn = useServerFn(listWorkspaceMembers);
  const invitesFn = useServerFn(listWorkspaceInvitations);
  const inviteFn = useServerFn(createInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const roleFn = useServerFn(updateMemberRole);
  const removeFn = useServerFn(removeMember);

  const { data: workspaces } = useQuery({
    queryKey: ["team-workspaces"],
    queryFn: () => workspacesFn(),
  });
  const [wsId, setWsId] = useState<string | undefined>();
  const workspaceId = wsId ?? workspaces?.[0]?.id;

  const { data: members = [] } = useQuery({
    queryKey: ["team-members", workspaceId],
    queryFn: () => membersFn({ data: { workspaceId: workspaceId! } }),
    enabled: !!workspaceId,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["team-invites", workspaceId],
    queryFn: () => invitesFn({ data: { workspaceId: workspaceId! } }),
    enabled: !!workspaceId,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [sending, setSending] = useState(false);

  const pendingInvites = useMemo(() => invites.filter((i) => i.status === "pending"), [invites]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setSending(true);
    try {
      await inviteFn({
        data: { workspaceId, email: inviteEmail.trim(), role: inviteRole },
      });
      setInviteEmail("");
      toast.success("Invitation sent");
      qc.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite");
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeFn({ data: { invitationId: id } });
      toast.success("Invitation revoked");
      qc.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke");
    }
  }

  async function handleRoleChange(memberId: string, role: Role) {
    if (!workspaceId) return;
    try {
      await roleFn({ data: { workspaceId, memberId, role } });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["team-members", workspaceId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update role");
    }
  }

  async function handleRemove(memberId: string) {
    if (!workspaceId) return;
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      await removeFn({ data: { workspaceId, memberId } });
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["team-members", workspaceId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member");
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Invite link copied"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLockup />
          <Link to="/app">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage members and invitations for your workspace.
            </p>
          </div>
          {(workspaces?.length ?? 0) > 1 && (
            <div className="w-64">
              <Label className="text-xs text-muted-foreground">Workspace</Label>
              <Select value={workspaceId} onValueChange={setWsId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaces!.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Invite form */}
        <section className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Invite a teammate
            </h2>
          </div>
          <form onSubmit={handleInvite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <div>
              <Label htmlFor="invite-email" className="sr-only">
                Email
              </Label>
              <Input
                id="invite-email"
                type="email"
                required
                autoComplete="email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={sending || !workspaceId}>
              <Mail className="mr-2 h-4 w-4" />
              Send invite
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[inviteRole]}</p>
        </section>

        {/* Members */}
        <section className="mt-8 rounded-2xl border border-border/60 bg-card/40">
          <div className="border-b border-border/60 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Members ({members.length})
            </h2>
          </div>
          <ul className="divide-y divide-border/60">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {m.profile.display_name || m.profile.email || m.user_id}
                  </div>
                  {m.profile.email && (
                    <div className="text-xs text-muted-foreground">{m.profile.email}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v as Role)}>
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(m.id)}
                    aria-label="Remove member"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Invitations */}
        <section className="mt-8 rounded-2xl border border-border/60 bg-card/40">
          <div className="border-b border-border/60 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending invitations ({pendingInvites.length})
            </h2>
          </div>
          {pendingInvites.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No pending invitations.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {pendingInvites.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{i.email}</div>
                    <div className="text-xs text-muted-foreground">
                      <Shield className="mr-1 inline h-3 w-3" />
                      {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyInviteLink(i.token)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRevoke(i.id)}>
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
