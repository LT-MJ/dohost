import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <Alert variant={error ? "destructive" : "default"}>
      {error ? <AlertCircleIcon className="size-4" /> : <CheckCircle2Icon className="size-4" />}
      <AlertDescription>{error ?? success}</AlertDescription>
    </Alert>
  );
}
