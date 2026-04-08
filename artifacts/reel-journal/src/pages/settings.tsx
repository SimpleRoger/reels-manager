import { useGetInstagramStatus, useSyncReels, useConnectInstagram, getGetInstagramStatusQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Instagram, RefreshCw, AlertCircle } from "lucide-react";

const connectSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
});

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: status, isLoading: isStatusLoading } = useGetInstagramStatus({
    query: { queryKey: getGetInstagramStatusQueryKey() }
  });

  const connectMutation = useConnectInstagram();
  const syncMutation = useSyncReels();

  const form = useForm<z.infer<typeof connectSchema>>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      accessToken: "",
    },
  });

  function onSubmit(values: z.infer<typeof connectSchema>) {
    connectMutation.mutate({ data: { accessToken: values.accessToken } }, {
      onSuccess: () => {
        toast({ title: "Connected to Instagram successfully" });
        queryClient.invalidateQueries({ queryKey: getGetInstagramStatusQueryKey() });
        form.reset();
      },
      onError: (error) => {
        toast({ 
          title: "Connection failed", 
          description: error.error || "Please check your access token.",
          variant: "destructive"
        });
      }
    });
  }

  function handleSync() {
    syncMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast({ 
          title: "Sync Complete", 
          description: `Synced ${data.synced} reels. ${data.message}` 
        });
        queryClient.invalidateQueries({ queryKey: getGetInstagramStatusQueryKey() });
      },
      onError: (error) => {
        toast({ 
          title: "Sync failed", 
          description: error.error || "Failed to sync reels.",
          variant: "destructive"
        });
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your Instagram connection and sync preferences.</p>
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5" /> Instagram Connection
          </CardTitle>
          <CardDescription>
            Connect your Instagram Creator or Business account via Graph API to automatically sync your Reels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isStatusLoading && status?.connected ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-4">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-sm text-foreground">Connected as @{status.username}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Last synced: {formatDateTime(status.lastSynced) || "Never"}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSync} 
                disabled={syncMutation.isPending}
                className="font-mono uppercase text-xs tracking-wider"
              >
                {syncMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync Now
              </Button>
            </div>
          ) : !isStatusLoading ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <h3 className="font-medium text-sm text-destructive">Not Connected</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  You need to provide a long-lived Graph API access token.
                </p>
              </div>
            </div>
          ) : null}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t border-border">
              <FormField
                control={form.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="EAAGm0PX4ZC..." 
                        type="password"
                        {...field} 
                        className="font-mono text-xs bg-background"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                disabled={connectMutation.isPending}
                className="font-mono text-xs uppercase tracking-wider"
              >
                {status?.connected ? "Update Token" : "Connect Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
