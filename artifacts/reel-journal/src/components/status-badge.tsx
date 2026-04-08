import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  
  if (status === "overperforming") {
    return <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm uppercase text-[10px] tracking-wider py-0 px-2 h-5">Overperforming</Badge>;
  }
  
  if (status === "underperforming") {
    return <Badge variant="destructive" className="rounded-sm uppercase text-[10px] tracking-wider py-0 px-2 h-5">Underperforming</Badge>;
  }

  return <Badge variant="secondary" className="rounded-sm uppercase text-[10px] tracking-wider py-0 px-2 h-5">Normal</Badge>;
}
