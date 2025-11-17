import CodeRunner from "@/app/components/codeRunner";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-4xl p-4">
        <CodeRunner />
      </div>
    </main>
  );
}
