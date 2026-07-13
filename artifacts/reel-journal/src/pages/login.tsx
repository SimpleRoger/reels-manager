import { SignIn, useAuth } from "@clerk/react";
import { Redirect } from "wouter";

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useAuth();

  if (isLoaded && isSignedIn) return <Redirect to="/calendar" />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground">
        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
        Reel Journal
      </div>
      <SignIn
        routing="hash"
        appearance={{
          variables: {
            colorBackground: "#13151a",
            colorText: "#dde0eb",
            colorTextSecondary: "#8b90a8",
            colorInputBackground: "#1e2028",
            colorInputText: "#dde0eb",
            colorPrimary: "#f07d1a",
            colorTextOnPrimaryBackground: "#ffffff",
            borderRadius: "0.75rem",
          },
          elements: {
            card: { background: "#13151a", border: "1px solid #20232e", boxShadow: "none" },
            headerTitle: { color: "#dde0eb" },
            headerSubtitle: { color: "#8b90a8" },
            formFieldInput: { background: "#1e2028", color: "#dde0eb", borderColor: "#272b38" },
            formFieldLabel: { color: "#8b90a8" },
            socialButtonsBlockButton: { background: "#1e2028", borderColor: "#272b38", color: "#dde0eb" },
            socialButtonsBlockButtonText: { color: "#dde0eb" },
            dividerLine: { background: "#20232e" },
            dividerText: { color: "#8b90a8" },
            footerActionText: { color: "#8b90a8" },
            footerActionLink: { color: "#f07d1a" },
            identityPreviewText: { color: "#dde0eb" },
            identityPreviewEditButton: { color: "#f07d1a" },
          },
        }}
      />
    </div>
  );
}
