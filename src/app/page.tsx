import { Suspense } from "react";
import Three from "./components/three";
import { LoaderCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="flex h-screen justify-center items-center">
      <Suspense
        fallback={
          <LoaderCircle className="size-4 animate-spin text-emerald-300" />
        }
      >
        <Three />
      </Suspense>
    </div>
  );
}
