export default function AvatarGroup({ avatars = [] }: { avatars: { name: string; avatarUrl: string }[] }) {
  return (
    <div className="flex items-center -space-x-2">
      {avatars.slice(0, 4).map((a, i) => (
        <img key={i} src={a.avatarUrl} alt={a.name} className="w-7 h-7 rounded-full border-2 border-card object-cover" />
      ))}
      {avatars.length > 4 && <div className="w-7 h-7 rounded-full bg-line/80 flex items-center justify-center text-[10px] font-bold">+{avatars.length - 4}</div>}
    </div>
  );
}
