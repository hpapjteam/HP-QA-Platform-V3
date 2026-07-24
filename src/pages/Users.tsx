import React, { useState, useEffect } from "react";
import { Users, UserPlus, Save, Pencil, Trash2, Plus, X, Ban, CheckCircle, LogIn, ListChecks, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/logger";

export function UsersList({ onLoginAsUser }: { onLoginAsUser?: (email: string, role: string) => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [isEditingUser, setIsEditingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "user", team: "", status: "active" });
  const [teams, setTeams] = useState<any[]>([]);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamChecklists, setTeamChecklists] = useState<any[]>([]);

  const loadData = async () => {
    const { data: userData } = await supabase.from('app_users').select('*').order('created_at', { ascending: true });
    if (userData) {
      setUsers(userData);
    }
    const { data: teamData } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
    if (teamData) {
      setTeams(teamData);
      if (teamData.length > 0) {
        setUserForm(prev => ({ ...prev, team: prev.team || teamData[0].name }));
      }
    }
  };

  useEffect(() => {
    loadData();
    const stored = localStorage.getItem("platform_checklists");
    if (stored) {
      setTeamChecklists(JSON.parse(stored));
    }
  }, []);
  
  const activeChecklist = teamChecklists.find(c => c.team === userForm.team);

  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const handleAddTeam = async () => {
    if (newTeamName.trim()) {
      const { data, error } = await supabase.from('teams').insert([{ name: newTeamName.trim() }]).select();
      if (!error && data) {
        setTeams([...teams, data[0]]);
        setUserForm({...userForm, team: data[0].name});
        setIsAddingTeam(false);
        setNewTeamName("");
        await logAction("admin", "Add Team", `Added team: ${newTeamName.trim()}`);
      }
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditingUser) {
      const { error } = await supabase.from('app_users').update({
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        team: userForm.team,
        status: userForm.status || "active"
      }).eq('id', isEditingUser);

      if (!error) {
        await loadData();
        setIsEditingUser(null);
        await logAction("admin", "Edit User", `Updated user: ${userForm.email}`);
        setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active" });
      }
    } else {
      setIsSendingInvite(true);
      try {
        const inviteUrl = `${window.location.origin}/signup?email=${encodeURIComponent(userForm.email)}&name=${encodeURIComponent(userForm.name)}&team=${encodeURIComponent(userForm.team)}&role=${encodeURIComponent(userForm.role)}`;
        
        await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...userForm, inviteUrl })
        });
      } catch (error) {
        console.error(error);
      } finally {
        const { data, error } = await supabase.from('app_users').insert([
          {
            name: userForm.name,
            email: userForm.email,
            role: userForm.role,
            team: userForm.team,
            status: "active",
            last_login: "Never"
          }
        ]).select();

        if (!error && data) {
          await loadData();
          setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active" });
          alert("User created successfully!");
        } else {
          alert("Error creating user: " + (error?.message || "Unknown error"));
        }
        setIsSendingInvite(false);
      }
    }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (!error) {
      await loadData();
      await logAction("admin", "Delete User", `Deleted user record`);
    }
  };

  const toggleBanUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newStatus = user.status === "banned" ? "active" : "banned";
    
    const { error } = await supabase.from('app_users').update({ status: newStatus }).eq('id', id);
    if (!error) {
      await loadData();
      await logAction("admin", "Toggle Ban", `Changed status for user ${user.email} to ${newStatus}`);
    }
  };

  const editUser = (u: any) => {
    setIsEditingUser(u.id);
    setUserForm({ name: u.name, email: u.email, role: u.role, team: u.team, status: u.status || "active" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/60">
      <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2b61d6]" />
            User Management
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Manage platform accounts, role permissions, and team assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg text-xs font-bold">
            Total Users: {users.length}
          </span>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-bold">
            Teams: {teams.length}
          </span>
        </div>
      </header>

      <div className="p-6 md:p-8 space-y-6 w-full max-w-7xl mx-auto flex-1 overflow-y-auto">
        
        {!isEditingUser && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/30 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#2b61d6]" />
                  Invite & Add New User
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Create an account and send an email invitation.</p>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Jane Doe"
                      value={userForm.name}
                      onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                      className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="jane@example.com"
                      value={userForm.email}
                      onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Role Level</label>
                    <select 
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                      className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    >
                      <option value="user">User (Standard QA Access)</option>
                      <option value="admin">Admin (Full Control)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Team</label>
                      {!isAddingTeam && (
                        <button 
                          type="button" 
                          onClick={() => setIsAddingTeam(true)}
                          className="text-xs text-[#2b61d6] hover:underline font-bold flex items-center cursor-pointer"
                        >
                          <Plus className="h-3 w-3 mr-0.5" /> Add New Team
                        </button>
                      )}
                    </div>
                    {isAddingTeam ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="New team name..."
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="w-full flex h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddTeam}
                          className="h-9 px-3 bg-[#2b61d6] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsAddingTeam(false); setNewTeamName(""); }}
                          className="h-9 px-3 border border-slate-300 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <select 
                        value={userForm.team}
                        onChange={(e) => setUserForm({...userForm, team: e.target.value})}
                        className="w-full flex h-9 rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      >
                        {teams.length === 0 && <option value="" disabled>No teams available</option>}
                        {teams.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isSendingInvite} className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer">
                    <UserPlus className="h-4 w-4" />
                    {isSendingInvite ? "Sending Invite..." : "Send Invite & Add User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Active Platform Accounts
            </h3>
            <span className="text-xs text-slate-500 font-medium">Showing {users.length} users</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100/60 border-b border-slate-200 text-left">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Team</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Last Active</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs",
                          u.role === "admin" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-blue-100 text-[#2b61d6] border border-blue-200"
                        )}>
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className={cn(u.status === "banned" && "text-slate-400 line-through decoration-slate-300")}>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 font-medium">{u.email}</td>
                    <td className="px-6 py-3.5">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full font-bold text-[10px] border shadow-2xs",
                        u.role === "admin" ? "bg-purple-100 text-purple-800 border-purple-300" : "bg-blue-100 text-[#2b61d6] border-blue-300"
                      )}>
                        {u.role === "admin" ? "👑 Admin" : "👤 User"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold text-[11px] border border-amber-200">
                        {u.team || "HP-APJ"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full font-bold text-[10px] border inline-flex items-center gap-1",
                        u.status === "banned" ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      )}>
                        {u.status === "banned" ? "🔴 Banned" : "🟢 Active"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 font-medium">{u.last_login || "Never"}</td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        {u.email !== "cbogineni@zetaglobal.com" && (
                          <>
                            <button onClick={() => toggleBanUser(u.id)} title={u.status === "banned" ? "Unban User" : "Ban User"} className={cn("p-1.5 rounded-lg transition-colors cursor-pointer", u.status === "banned" ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100" : "text-amber-600 hover:text-amber-800 hover:bg-amber-100")}>
                              {u.status === "banned" ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                            </button>
                            
                            {onLoginAsUser && (
                              <button onClick={() => onLoginAsUser(u.email, u.role)} title="Login as User" className="p-1.5 text-[#2b61d6] hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer">
                                <LogIn className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => editUser(u)} title="Edit User" className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteUser(u.id)} title="Delete User" className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {u.email === "cbogineni@zetaglobal.com" && onLoginAsUser && (
                           <button onClick={() => onLoginAsUser(u.email, u.role)} title="Login as User" className="p-1.5 text-[#2b61d6] hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer">
                              <LogIn className="h-4 w-4" />
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Edit User Modal */}
      {isEditingUser && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col max-h-full">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Edit User</h3>
              <button 
                onClick={() => { setIsEditingUser(null); setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active" }); }}
                className="text-slate-400 hover:text-slate-500 transition-colors p-1 rounded-md hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <form id="edit-user-form" onSubmit={handleUserSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Full Name</label>
                  <input 
                    type="text" 
                    value={userForm.name}
                    onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                    className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <input 
                    type="email" 
                    value={userForm.email}
                    onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                    className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Role</label>
                    <select 
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                      className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Team</label>
                    <select 
                      value={userForm.team}
                      onChange={(e) => setUserForm({...userForm, team: e.target.value})}
                      className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                    >
                      {teams.length === 0 && <option value="" disabled>No teams available</option>}
                      {teams.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { setIsEditingUser(null); setUserForm({ name: "", email: "", role: "user", team: teams.length > 0 ? teams[0].name : "", status: "active" }); }}
                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="edit-user-form"
                disabled={isSendingInvite} 
                className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Update User
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
