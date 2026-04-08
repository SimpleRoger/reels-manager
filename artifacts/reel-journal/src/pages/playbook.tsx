import { useState } from "react";
import { useListPlaybookLessons, getListPlaybookLessonsQueryKey, useCreatePlaybookLesson, useDeletePlaybookLesson } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trash2, BookOpen, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Playbook() {
  const { data, isLoading } = useListPlaybookLessons({
    query: { queryKey: getListPlaybookLessonsQueryKey() }
  });
  
  const createMutation = useCreatePlaybookLesson();
  const deleteMutation = useDeletePlaybookLesson();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [lessonInput, setLessonInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [filter, setFilter] = useState("");

  const categories = Array.from(new Set(data?.lessons?.map(l => l.category).filter(Boolean) as string[]));
  
  const filteredLessons = data?.lessons?.filter(l => 
    (!filter || l.category === filter) &&
    (l.lesson.toLowerCase().includes(lessonInput.toLowerCase()) || 
     (l.category && l.category.toLowerCase().includes(categoryInput.toLowerCase())))
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonInput.trim()) return;

    createMutation.mutate({ data: { lesson: lessonInput, category: categoryInput || undefined } }, {
      onSuccess: () => {
        toast({ title: "Lesson added" });
        setLessonInput("");
        setCategoryInput("");
        queryClient.invalidateQueries({ queryKey: getListPlaybookLessonsQueryKey() });
      }
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this lesson?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlaybookLessonsQueryKey() });
      }
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Playbook</h1>
        <p className="text-muted-foreground text-sm">Your accumulated knowledge and strategy rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-card border-card-border sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Add New Lesson</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">The Lesson</label>
                  <Input 
                    placeholder="e.g. Hooks under 2s perform better..." 
                    value={lessonInput} 
                    onChange={e => setLessonInput(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Category (Optional)</label>
                  <Input 
                    placeholder="e.g. Editing, Hooks, Strategy" 
                    value={categoryInput} 
                    onChange={e => setCategoryInput(e.target.value)}
                    className="bg-background"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full font-mono text-xs uppercase tracking-wider">
                  <Plus className="w-4 h-4 mr-2" /> Add Rule
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
            <Badge 
              variant={filter === "" ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => setFilter("")}
            >
              All
            </Badge>
            {categories.map(c => (
              <Badge 
                key={c} 
                variant={filter === c ? "default" : "outline"} 
                className="cursor-pointer"
                onClick={() => setFilter(c)}
              >
                {c}
              </Badge>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : filteredLessons?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
              <BookOpen className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No lessons found. Add one to start building your playbook.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLessons?.map(lesson => (
                <Card key={lesson.id} className="bg-card hover:border-primary/50 transition-colors group">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {lesson.category && (
                          <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wider py-0 px-1.5 h-4">
                            {lesson.category}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono">{formatDateTime(lesson.createdAt)}</span>
                      </div>
                      <p className="text-card-foreground text-sm font-medium leading-relaxed">{lesson.lesson}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(lesson.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
