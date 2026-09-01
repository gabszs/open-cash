import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { authClient } from "@/lib/authClient";
import { cn } from "@/lib/classNames";

/**
 * `users.image` holds either an absolute URL the user pasted or an R2 file id
 * produced by the Cloudflare plugin. File ids stay environment-agnostic, so the
 * bytes are fetched through `POST /files/download` — the plugin exposes no GET an
 * `<img>` could reach — and turned into an object URL cached per file id.
 */
function isExternalUrl(image: string) {
	return image.startsWith("http://") || image.startsWith("https://");
}

/** Resolves `users.image` into something an `<img src>` can use, or null. */
export function useAvatarSrc(image?: string | null) {
	const fileId = image && !isExternalUrl(image) ? image : null;
	const query = useQuery({
		enabled: Boolean(fileId),
		gcTime: Number.POSITIVE_INFINITY,
		queryFn: async () => {
			const result = await authClient.files.download({ fileId });
			if (result.error) {
				throw new Error(result.error.message ?? "Falha ao carregar a foto.");
			}
			// better-fetch already consumed the image/* response into a Blob, even
			// though the plugin types the endpoint as returning a Response.
			return URL.createObjectURL(result.data as Blob);
		},
		queryKey: ["avatar", fileId],
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
	if (!image) return null;
	return fileId ? (query.data ?? null) : image;
}

export function Avatar({
	image,
	name,
	size = "compact",
	className = "",
}: {
	image?: string | null;
	name?: string | null;
	size?: "compact" | "large";
	className?: string;
}) {
	// Tracked by src so a new upload retries instead of staying on the initial.
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const src = useAvatarSrc(image);

	return (
		<span
			className={cn(
				"grid place-items-center overflow-hidden rounded-md bg-sidebar-accent font-medium text-muted-foreground uppercase select-none [&_img]:size-full [&_img]:object-cover",
				size === "compact" ? "size-7 text-xs" : "size-12 rounded-lg text-[17px]",
				className,
			)}
		>
			{src && src !== failedSrc ? (
				<img src={src} alt="" onError={() => setFailedSrc(src)} />
			) : (
				(name?.slice(0, 1) ?? "U")
			)}
		</span>
	);
}
