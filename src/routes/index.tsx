import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shell } from "@/components/store/shell";
import { useStore } from "@/lib/store/store";
import { LOGO_URL } from "@/lib/store/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const ready = useStore((s) => s.ready);
  useEffect(() => {
    void useStore.getState().boot();
  }, []);
  if (!ready) return <Splash />;
  return <Shell />;
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-teal text-ivory">
      <img src={LOGO_URL} alt="" className="size-20 rounded-2xl object-cover" />
      <p className="font-display text-3xl font-bold">
        JM<span className="text-marigold">-</span>Store
      </p>
      <p className="text-sm text-ivory/80">Opening the catalogue…</p>
    </div>
  );
}
