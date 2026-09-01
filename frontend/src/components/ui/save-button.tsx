import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SaveButtonProps extends React.ComponentProps<typeof Button> {
  isSaving: boolean;
  label?: string;
  savingLabel?: string;
}

export function SaveButton({
  isSaving,
  label = "Save Changes",
  savingLabel = "Saving...",
  className,
  disabled,
  ...props
}: SaveButtonProps) {
  return (
    <Button
      disabled={disabled || isSaving}
      className={cn(
        "bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px] h-12 rounded-xl font-semibold shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgb(79,70,229,0.23)] hover:-translate-y-0.5 transition-all duration-300 active:scale-95",
        className
      )}
      {...props}
    >
      {isSaving ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <Save className="w-5 h-5 mr-2" />
      )}
      {isSaving ? savingLabel : label}
    </Button>
  );
}
