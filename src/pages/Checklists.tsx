import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export interface ChecklistItem {
  id: string;
  text: string;
}

export interface TeamChecklist {
  team: string;
  items: ChecklistItem[];
}

export function Checklists({ role }: { role: string }) {
  const [checklists, setChecklists] = useState<TeamChecklist[]>([]);
  const [activeTeam, setActiveTeam] = useState<string>("HP-APJ");
  const [newItemText, setNewItemText] = useState("");
  const [teams, setTeams] = useState<string[]>(["HP-APJ", "HP-EMEA", "HP-AMS"]);

  useEffect(() => {
    const fetchTeams = async () => {
      if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co') {
        const { data } = await supabase.from('teams').select('*').order('created_at', { ascending: true });
        if (data && data.length > 0) {
          const teamNames = data.map(t => t.name);
          setTeams(teamNames);
          if (!teamNames.includes(activeTeam)) {
            setActiveTeam(teamNames[0]);
          }
        }
      }
    };
    fetchTeams();

    // Load from local storage
    const stored = localStorage.getItem("platform_checklists");
    if (stored) {
      setChecklists(JSON.parse(stored));
    } else {
      // Default checklists
      const defaults = [
        {
          team: "HP-APJ",
          items: [
            { id: "1", text: "Verify APJ specific legal compliance" },
            { id: "2", text: "Check translations for APAC regions" }
          ]
        },
        {
          team: "HP-EMEA",
          items: [
            { id: "3", text: "Ensure GDPR compliance points are met" },
            { id: "4", text: "Verify EMEA pricing formats" }
          ]
        }
      ];
      setChecklists(defaults);
      localStorage.setItem("platform_checklists", JSON.stringify(defaults));
    }
  }, []);

  const saveChecklists = (newChecklists: TeamChecklist[]) => {
    setChecklists(newChecklists);
    localStorage.setItem("platform_checklists", JSON.stringify(newChecklists));
  };

  const activeChecklist = checklists.find(c => c.team === activeTeam) || { team: activeTeam, items: [] };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    
    const newItem = { id: Date.now().toString(), text: newItemText.trim() };
    const newChecklists = [...checklists];
    const teamIndex = newChecklists.findIndex(c => c.team === activeTeam);
    
    if (teamIndex >= 0) {
      newChecklists[teamIndex].items.push(newItem);
    } else {
      newChecklists.push({ team: activeTeam, items: [newItem] });
    }
    
    saveChecklists(newChecklists);
    setNewItemText("");
  };

  const handleDeleteItem = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this checkpoint?")) return;
    const newChecklists = checklists.map(c => {
      if (c.team === activeTeam) {
        return { ...c, items: c.items.filter(item => item.id !== id) };
      }
      return c;
    });
    saveChecklists(newChecklists);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Checklists</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage campaign review checkpoints for different teams.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-64 flex flex-col gap-2">
          {teams.map(team => (
            <button
              key={team}
              onClick={() => setActiveTeam(team)}
              className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTeam === team ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {team} Checkpoints
            </button>
          ))}
        </div>

        <Card className="flex-1 shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle>{activeTeam} Checkpoints</CardTitle>
            <CardDescription>Points to verify during campaign review for {activeTeam}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleAddItem} className="flex gap-3">
              <Input 
                placeholder="New checkpoint text..." 
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" className="gap-2">
                <Plus className="w-4 h-4" /> Add Point
              </Button>
            </form>

            <div className="space-y-3">
              {activeChecklist.items.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No checkpoints defined for {activeTeam}.
                </div>
              ) : (
                activeChecklist.items.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg group">
                    <CheckCircle2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="flex-1 text-sm text-slate-700 leading-relaxed">{item.text}</span>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteItem(item.id)}
                      className="h-7 w-7 text-rose-500 hover:bg-rose-50 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
