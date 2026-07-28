import React, { useState, useEffect, useRef } from "react";
import { User, Globe, Save, Plus, Pencil, Trash2, Users, Upload, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { logAction } from "@/lib/logger";
import { Image as ImageIcon } from "lucide-react";

const defaultCountries: any[] = [];
const defaultTeams: any[] = [];

export function Settings({ role }: { role: string }) {

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile State
  const [profile, setProfile] = useState({
    name: role === "admin" ? "Admin User" : "QA User",
    email: role === "admin" ? "cbogineni@zetaglobal.com" : "cbogineni@gmail.com",
    team: "HP-APJ",
    avatar: ""
  });
  
  // Countries State
  const [countries, setCountries] = useState(defaultCountries);
  const [isEditingCountry, setIsEditingCountry] = useState<string | null>(null);
  const [isCreatingNewCountry, setIsCreatingNewCountry] = useState(false);
  const [countryForm, setCountryForm] = useState({ name: "", code: "", url: "" });

  // Teams State
  const [teams, setTeams] = useState(defaultTeams);
  const [logs, setLogs] = useState<any[]>([]);
  const [teamForm, setTeamForm] = useState({ name: "" });
  const [logos, setLogos] = useState({ expanded: "https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg", collapsed: "https://companieslogo.com/img/orig/ZETA-424536bc.png" });
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>("All");

  useEffect(() => {
    async function loadData() {
      const savedProfile = localStorage.getItem("settings_profile_" + role);
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
      
      const { data: cData } = await supabase.from('countries').select('*').order('created_at', { ascending: true });
      if (cData) setCountries(cData);
      
      const { data: tData } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
      if (tData) setTeams(tData);

      const { data: sData } = await supabase.from('app_settings').select('*').limit(1).single();

      const { data: lData } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (lData) setLogs(lData);

      if (sData) {
        setLogos({ expanded: sData.expanded_logo_url || "", collapsed: sData.collapsed_logo_url || "" });
      }
    }
    loadData();
  }, [role]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("settings_profile_" + role, JSON.stringify(profile));
    alert("Profile saved successfully! Reload the page to see avatar updates on the sidebar.");
  };

  const [countryFormError, setCountryFormError] = useState<string | null>(null);
  
  const handleCountrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Duplicate check
    const duplicate = countries.find(c => 
      c.id !== isEditingCountry && 
      (
        (c.name.toLowerCase() === countryForm.name.toLowerCase() && c.code.toLowerCase() === countryForm.code.toLowerCase()) ||
        c.url.toLowerCase() === countryForm.url.toLowerCase()
      )
    );

    if (duplicate) {
      if (duplicate.name.toLowerCase() === countryForm.name.toLowerCase() && duplicate.code.toLowerCase() === countryForm.code.toLowerCase()) {
         setCountryFormError(`Version '${duplicate.code}' is already added for '${duplicate.name}'.`);
      } else {
         setCountryFormError(`URL '${duplicate.url}' is already used by '${duplicate.name}' - Version '${duplicate.code}'.`);
      }
      return;
    }
    setCountryFormError(null);

    if (isEditingCountry) {
      const { data, error } = await supabase.from('countries').update({
        name: countryForm.name,
        code: countryForm.code,
        url: countryForm.url
      }).eq('id', isEditingCountry).select();
      if (!error && data) {
        setCountries(countries.map(c => c.id === isEditingCountry ? data[0] : c));
        setIsEditingCountry(null);
        await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Update Country", `Updated country: ${countryForm.name}`);
        setCountryForm({ name: "", code: "", url: "" });
      }
    } else {
      const { data, error } = await supabase.from('countries').insert([
        { name: countryForm.name, code: countryForm.code, url: countryForm.url }
      ]).select();
      if (!error && data) {
        setCountries([...countries, data[0]]);
        await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Add Country", `Added country: ${countryForm.name} (${countryForm.code})`);
        setCountryForm({ name: "", code: "", url: "" });
      }
    }
  };

  const deleteCountry = async (id: string) => {
    const { error } = await supabase.from('countries').delete().eq('id', id);
    if (!error) {
      setCountries(countries.filter(c => c.id !== id));
      await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Delete Country", `Deleted country`);
    }
  };

  const editCountry = (c: any) => {
    setIsEditingCountry(c.id);
    setCountryForm({ name: c.name, code: c.code, url: c.url });
    setActiveTab("countries");
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('teams').insert([{ name: teamForm.name }]).select();
    if (!error && data) {
      setTeams([...teams, data[0]]);
      await logAction(profile.email || (role === "admin" ? "admin@example.com" : "qa@example.com"), "Add Team", `Added team: ${teamForm.name}`);
      setTeamForm({ name: "" });
    } else if (error) {
      alert("Error adding team: " + error.message);
    }
  };

  const deleteTeam = async (id: string) => {
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (!error) {
      setTeams(teams.filter(t => t.id !== id));
      await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Delete Team", `Deleted team`);
    }
  };


  const handleLogosSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Assuming a single row exists or we upsert
    const { data: sData } = await supabase.from('app_settings').select('id').limit(1).single();
    if (sData) {
      await supabase.from('app_settings').update({
        expanded_logo_url: logos.expanded,
        collapsed_logo_url: logos.collapsed
      }).eq('id', sData.id);
    } else {
      await supabase.from('app_settings').insert([{
        expanded_logo_url: logos.expanded,
        collapsed_logo_url: logos.collapsed
      }]);
    }
    await logAction(profile.email || role === "admin" ? "admin@example.com" : "qa@example.com", "Update Logos", "Updated application logos");
    alert("Logos saved successfully");
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/60">
      <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[#2b61d6]" />
            Platform Settings & Configuration
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Manage user profile, regional URLs, teams, logos, and audit logs</p>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 py-6">
          <nav className="flex-1 px-4 space-y-1.5">
            <button
              onClick={() => setActiveTab("profile")}
              className={cn(
                "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                activeTab === "profile" 
                  ? "bg-blue-50 text-[#2b61d6] shadow-2xs border border-blue-200" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <User className="h-4 w-4 text-blue-600" />
              <span>My Profile</span>
            </button>
            <button
              onClick={() => setActiveTab("countries")}
              className={cn(
                "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                activeTab === "countries" 
                  ? "bg-amber-50 text-amber-800 shadow-2xs border border-amber-200" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Globe className="h-4 w-4 text-amber-600" />
              <span>Countries & Version URLs</span>
            </button>
            {role === "admin" && (
              <button 
                onClick={() => setActiveTab("logs")}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeTab === "logs" 
                    ? "bg-emerald-50 text-emerald-800 shadow-2xs border border-emerald-200" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <div className="h-4 w-4 flex items-center justify-center text-emerald-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                <span>Activity Audit Logs</span>
              </button>
            )}
            {role === "admin" && (
              <button 
                onClick={() => setActiveTab("logos")}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  activeTab === "logos" 
                    ? "bg-purple-50 text-purple-800 shadow-2xs border border-purple-200" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <ImageIcon className="h-4 w-4 text-purple-600" />
                <span>Platform Logos</span>
              </button>
            )}
            {role === "admin" && (
              <button
                onClick={() => setActiveTab("teams")}
                className={cn(
                  "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold cursor-pointer",
                  activeTab === "teams" 
                    ? "bg-indigo-50 text-indigo-800 shadow-2xs border border-indigo-200" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Users className="h-4 w-4 text-indigo-600" />
                <span>Teams</span>
              </button>
            )}
          </nav>
        </aside>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="w-full">
            {activeTab === "profile" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                  <h3 className="text-lg font-semibold text-slate-900">Profile Settings</h3>
                  <p className="text-sm text-slate-500">Update your personal information and team.</p>
                </div>
                <div className="p-6">
                  <form onSubmit={saveProfile} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Profile Picture</label>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[#2b61d6] overflow-hidden border border-slate-200">
                          {profile.avatar ? (
                            <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                          ) : (
                            profile.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1">
                          <input 
                            type="file" 
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Upload className="h-4 w-4" />
                            Upload Photo
                          </button>
                          <p className="text-xs text-slate-500 mt-1">Recommended size: 256x256px</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <input 
                        type="text" 
                        value={profile.name}
                        onChange={(e) => setProfile({...profile, name: e.target.value})}
                        className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Email Address</label>
                      <input 
                        type="email" 
                        value={profile.email}
                        onChange={(e) => setProfile({...profile, email: e.target.value})}
                        className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Team</label>
                      <select 
                        value={profile.team}
                        onChange={(e) => setProfile({...profile, team: e.target.value})}
                        className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                      >
                        {teams.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                        <Save className="h-4 w-4" />
                        Save Profile
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "countries" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-slate-900">{isEditingCountry ? "Edit Country" : "Add New Country"}</h3>
                    <p className="text-sm text-slate-500">Configure regional settings for campaigns.</p>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleCountrySubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Country</label>
                          <div className="flex gap-2">
                            {isCreatingNewCountry || countries.length === 0 ? (
                              <input 
                                type="text" 
                                placeholder="e.g. Australia"
                                value={countryForm.name}
                                onChange={(e) => setCountryForm({...countryForm, name: e.target.value})}
                                className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                                required
                              />
                            ) : (
                              <select
                                value={countryForm.name}
                                onChange={(e) => {
                                  if (e.target.value === "__NEW__") {
                                    setIsCreatingNewCountry(true);
                                    setCountryForm({...countryForm, name: ""});
                                  } else {
                                    setCountryForm({...countryForm, name: e.target.value});
                                  }
                                }}
                                className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                                required
                              >
                                <option value="" disabled>Select a Country</option>
                                {Array.from(new Set(countries.map(c => c.name))).map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                                <option value="__NEW__">+ Add New Country...</option>
                              </select>
                            )}
                            {isCreatingNewCountry && countries.length > 0 && (
                              <button type="button" onClick={() => { setIsCreatingNewCountry(false); setCountryFormError(null); }} className="px-3 h-10 border border-slate-300 rounded-md text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Version</label>
                          <input 
                            type="text" 
                            placeholder="e.g. PUB"
                            value={countryForm.code}
                            onChange={(e) => setCountryForm({...countryForm, code: e.target.value})}
                            className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Version URL</label>
                        <input 
                          type="url" 
                          placeholder="https://www.hp.com/au-en/shop/"
                          value={countryForm.url}
                          onChange={(e) => setCountryForm({...countryForm, url: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        {countryFormError && (
                          <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-md text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            {countryFormError}
                          </div>
                        )}
                        <div className="flex justify-end pt-2 gap-3">
                        {isEditingCountry && (
                          <button 
                            type="button" 
                            onClick={() => { setIsEditingCountry(null); setCountryForm({ name: "", code: "", url: "" }); }}
                            className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          {isEditingCountry ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          {isEditingCountry ? "Update Country" : "Add Country"}
                        </button>
                      </div>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Configured Countries & Versions</h3>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600">Filter by Country:</label>
                      <select 
                        value={selectedCountryFilter} 
                        onChange={(e) => setSelectedCountryFilter(e.target.value)}
                        className="h-9 px-3 rounded-md border border-slate-300 bg-white text-sm"
                      >
                        <option value="All">All Countries</option>
                        {Array.from(new Set(countries.map(c => c.name))).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                        <th className="px-6 py-3">Country</th>
                        <th className="px-6 py-3">Version</th>
                        <th className="px-6 py-3">Version URL</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {countries.filter(c => selectedCountryFilter === "All" || c.name === selectedCountryFilter).map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200">{c.code}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{c.url}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => editCountry(c)} className="p-1.5 text-slate-400 hover:text-[#2b61d6] hover:bg-blue-50 rounded-md transition-colors">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => deleteCountry(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {countries.filter(c => selectedCountryFilter === "All" || c.name === selectedCountryFilter).length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No versions found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "logos" && role === "admin" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-slate-900">Logo Settings</h3>
                    <p className="text-sm text-slate-500">Configure application logos for the sidebar.</p>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleLogosSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Expanded Logo URL</label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg"
                          value={logos.expanded}
                          onChange={(e) => setLogos({...logos, expanded: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Collapsed Logo URL</label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://companieslogo.com/img/orig/ZETA-424536bc.png"
                          value={logos.collapsed}
                          onChange={(e) => setLogos({...logos, collapsed: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          <Save className="h-4 w-4" />
                          Save Logos
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
            {activeTab === "logs" && role === "admin" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-900">Platform Activity Logs</h3>
                    <p className="text-sm text-slate-500">View recent activity and actions across the platform.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                          <th className="px-6 py-3">Timestamp</th>
                          <th className="px-6 py-3">User</th>
                          <th className="px-6 py-3">Action</th>
                          <th className="px-6 py-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{log.user_email}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200">
                                {log.action_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {logs.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No activity logs available.
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === "teams" && role === "admin" && (
              <div className="space-y-8">
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-slate-900">Add New Team</h3>
                    <p className="text-sm text-slate-500">Create new teams for user assignment.</p>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleTeamSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Team Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. HP-AMERICAS"
                          value={teamForm.name}
                          onChange={(e) => setTeamForm({...teamForm, name: e.target.value})}
                          className="w-full flex h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2b61d6]"
                          required
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-[#2b61d6] text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                          <Plus className="h-4 w-4" />
                          Add Team
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-semibold text-slate-900">Configured Teams</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200 text-left">
                        <th className="px-6 py-3">Team Name</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {teams.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{t.name}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => deleteTeam(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {teams.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No teams configured.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
