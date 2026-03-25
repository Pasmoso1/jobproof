"use client";

import { UpdateTimelinePhotos } from "../update-timeline-photos";

export function ProofPhotoEvidence({
  photos,
}: {
  photos: { id: string; file_name: string; signedUrl: string | null }[];
}) {
  if (photos.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs text-zinc-500">
        Tap an image to view full size. Links expire after about an hour; refresh the page if needed.
      </p>
      <UpdateTimelinePhotos attachments={photos} />
    </div>
  );
}
