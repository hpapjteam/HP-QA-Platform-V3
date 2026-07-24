import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  title: string;
}

interface QAWizardProps {
  steps: Step[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onCancel: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  isSubmitting?: boolean;
  children: React.ReactNode;
}

export function QAWizard({
  steps,
  currentStep,
  onNext,
  onPrev,
  onCancel,
  onSubmit,
  isSubmitting,
  children
}: QAWizardProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Wizard Header / Step Indicator */}
      <div className="px-6 md:px-8 py-3 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
        <div className="w-full flex items-center justify-between mb-3">
          {steps.map((step, index) => {
            const stepNum = index + 1;
            const isCompleted = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;

            return (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      isCompleted
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                        ? "bg-[#2b61d6] text-white shadow-xs"
                        : "bg-slate-100 text-slate-500 border border-slate-300"
                    )}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold tracking-tight",
                      isCurrent ? "text-slate-900 font-bold" : isCompleted ? "text-slate-700" : "text-slate-400"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn("h-0.5 flex-1 mx-4 transition-colors", stepNum < currentStep ? "bg-emerald-500" : "bg-slate-200")} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-[#2b61d6] h-full transition-all duration-300 ease-in-out" 
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Step Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100/60 flex flex-col">
        <div className="w-full flex-1 flex flex-col">
          {children}
        </div>
      </div>

      {/* Wizard Footer Controls */}
      <div className="h-16 px-8 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between shadow-2xs">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-600 border-slate-300"
        >
          Cancel
        </Button>

        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPrev}
              className="gap-1 text-xs font-semibold text-slate-700 border-slate-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous
            </Button>
          )}

          {currentStep < steps.length ? (
            <Button
              type="button"
              size="sm"
              onClick={onNext}
              className="gap-1.5 bg-[#2b61d6] hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
            >
              Next Step
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              onClick={onSubmit}
              disabled={isSubmitting}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? "Saving Campaign..." : "Submit & Save Campaign"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
