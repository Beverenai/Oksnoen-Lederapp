import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset="calc(80px + env(safe-area-inset-bottom, 0px))"
      duration={2600}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast mx-auto flex w-fit max-w-[92vw] flex-col gap-2 rounded-[22px] bg-toast/95 px-4 py-3 text-toast-foreground shadow-[0_10px_40px_-8px_rgba(0,0,0,0.55)] backdrop-blur-xl",
          content: "flex flex-col gap-0.5",
          icon: "hidden",
          title: "text-[15px] font-medium leading-snug text-toast-foreground",
          error: "[&_[data-title]]:text-toast-danger",
          description: "text-[13px] leading-snug text-toast-muted",
          actionButton:
            "mt-1 w-full justify-center rounded-full bg-toast-action px-4 py-2 text-[15px] font-medium text-toast-foreground",
          cancelButton:
            "mt-1 w-full justify-center rounded-full bg-toast-action/60 px-4 py-2 text-[15px] font-medium text-toast-muted",
          closeButton: "bg-toast text-toast-muted border-0",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
