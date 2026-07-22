"use client";

import { useEffect, useState } from "react";
import { useRive } from "@rive-app/react-canvas";
import Image from "next/image";

type MascotStoryWorldProps = {
  reduceMotion?: boolean;
};

const STATE_MACHINE = "State Machine 1";

export default function MascotStoryWorld({ reduceMotion = false }: MascotStoryWorldProps) {
  const [ready, setReady] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: "/lora_idle_3:4_angle.riv",
    artboard: "CHARACTER_MASTER",
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    onLoad: () => setReady(true),
    onLoadError: () => setReady(false),
  });

  useEffect(() => {
    if (!rive) return;
    if (reduceMotion) rive.pause();
    else if (!rive.isPlaying) rive.play(STATE_MACHINE);
  }, [reduceMotion, rive]);

  return (
    <div className={`mascot-world${ready ? " is-ready" : ""}`}>
      <div className="mascot-world-fallback" aria-hidden="true">
        <Image src="/storia-landing/mascot-full.png" alt="" width={480} height={480} priority />
      </div>
      <RiveComponent
        className="mascot-rive"
        role="img"
        aria-label="Lora, Loratone's animated story guide"
      />
    </div>
  );
}
