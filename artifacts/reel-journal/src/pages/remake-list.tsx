import { useState } from "react";
import { useListReferences, getListReferencesQueryKey, useUpdateReference, useDeleteReference } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ExternalLink, Bookmark, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RemakeList() {
  const { data, isLoading } = useListReferences({
    query: { queryKey: getListReferencesQueryKey() }
  });

  const updateMutation = useUpdateReference();
  const deleteMutation = useDeleteReference();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ whyItsgood: string, whatToChange: string, howToRemake: string }>({
    whyItsgood: "", whatToChange: "", howToRemake: ""
  });

  function startEditing(ref: any) {
    setEditingId(ref.id);
    setEditValues({
      whyItsgood: ref.whyItsgood || "",
      whatToChange: ref.whatToChange || "",
      howToRemake: ref.howToRemake || ""
    });
  }

  function handleSave(id: number) {
    updateMutation.mutate({ id, data: editValues }, {
      onSuccess: () => {
        setEditingId(null);
        toast({ title: "Reference updated" });
        queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
      }
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Remove this reference from your list?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Reference removed" });
        queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
      }
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Remake List</h1>
        <p className="text-muted-foreground text-sm">Saved references and ideas for your next videos.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : data?.references.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
          <Bookmark className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Your remake list is empty. Use the Viral Finder to discover ideas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data?.references.map(ref => (
            <Card key={ref.id} className="bg-card hover-elevate border-card-border overflow-hidden flex flex-col h-full">
              <div className="p-4 bg-muted/30 border-b border-border flex justify-between items-start gap-4">
                <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs truncate flex items-center">
                  <ExternalLink className="w-3 h-3 mr-1 flex-shrink-0" /> {ref.url}
                </a>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(ref.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="text-xs text-muted-foreground line-clamp-2 mb-4 bg-background p-2 rounded border">
                  {ref.caption || "No caption"}
                </div>

                {editingId === ref.id ? (
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Why It's Good</label>
                      <Textarea 
                        value={editValues.whyItsgood} 
                        onChange={e => setEditValues(prev => ({...prev, whyItsgood: e.target.value}))}
                        className="h-20 text-xs resize-none bg-background"
                      />
                    </div>
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">What to Change</label>
                      <Textarea 
                        value={editValues.whatToChange} 
                        onChange={e => setEditValues(prev => ({...prev, whatToChange: e.target.value}))}
                        className="h-20 text-xs resize-none bg-background"
                      />
                    </div>
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">How to Remake</label>
                      <Textarea 
                        value={editValues.howToRemake} 
                        onChange={e => setEditValues(prev => ({...prev, howToRemake: e.target.value}))}
                        className="h-20 text-xs resize-none bg-background"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => handleSave(ref.id)} className="flex-1 font-mono uppercase text-[10px] tracking-wider h-8">
                        <Check className="w-3 h-3 mr-1" /> Save Notes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="flex-1 font-mono uppercase text-[10px] tracking-wider h-8">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1 flex flex-col cursor-pointer group" onClick={() => startEditing(ref)}>
                    <div className="flex-1">
                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Why It's Good</h4>
                      <p className="text-sm">{ref.whyItsgood || <span className="text-muted-foreground italic text-xs">Click to add notes...</span>}</p>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">What to Change</h4>
                      <p className="text-sm">{ref.whatToChange || <span className="text-muted-foreground italic text-xs">Click to add notes...</span>}</p>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">How to Remake</h4>
                      <p className="text-sm">{ref.howToRemake || <span className="text-muted-foreground italic text-xs">Click to add notes...</span>}</p>
                    </div>
                    <div className="pt-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary">Click anywhere to edit</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
