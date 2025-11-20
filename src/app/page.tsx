import { Star } from "lucide-react";

export default function Page() {
  return (
    <div className="flex items-center gap-2">
      <Star className="w-8 h-8 text-purple-500" />
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
        Sua Jornada
      </h1>
    </div>
  );
}