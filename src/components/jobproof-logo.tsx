import Image from "next/image";

export function JobProofLogo({
  className = "h-10 w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/jobproof-logo.png"
      alt="JobProof"
      width={160}
      height={40}
      className={className}
      priority={priority}
    />
  );
}
