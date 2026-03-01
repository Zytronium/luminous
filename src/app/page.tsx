import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-[80vw] rounded-[80] m-auto bg-dark-blue border-4 border-beige p-4">
      <p>Hello World!</p>
      <div className="h-12"/>
      <span className="text-xl">Links:</span>
      <div className="flex gap-4">
        <Link className="button btn-primary" href="/auth">Login/Sign Up</Link>
        <Link className="button btn-primary" href="/ai-example">View Example Chat UI</Link>
      </div>
    </div>
  );
}
