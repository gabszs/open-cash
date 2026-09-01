import { FileText, Paperclip, X } from "lucide-react";
import { useRef } from "react";

import { iconButtonClass } from "@/components/ui/styles";
import { FILE_ACCEPT, formatFileSize, mergeFiles } from "@/hooks/useConversations";

interface FilePickerProps {
	files: readonly File[];
	onChange: (files: File[]) => void;
	onError: (message: string) => void;
	disabled?: boolean;
}

export function FilePicker({ files, onChange, onError, disabled }: FilePickerProps) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<>
			<input
				ref={input}
				hidden
				type="file"
				multiple
				accept={FILE_ACCEPT}
				disabled={disabled}
				onChange={(event) => {
					try {
						onChange(mergeFiles(files, [...(event.target.files ?? [])]));
					} catch (error) {
						onError(error instanceof Error ? error.message : "Arquivo inválido.");
					} finally {
						event.target.value = "";
					}
				}}
			/>
			<button
				className={iconButtonClass({ size: "md" })}
				type="button"
				disabled={disabled}
				onClick={() => input.current?.click()}
				aria-label="Anexar Excel, Word, PDF ou arquivo de dados"
			>
				<Paperclip size={15} />
			</button>
			{files.map((file, index) => (
				<span
					className="flex max-w-48 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
					key={`${file.name}:${file.size}:${file.lastModified}`}
				>
					<FileText size={13} className="shrink-0 text-muted-foreground" />
					<span className="truncate">{file.name}</span>
					<small className="shrink-0 text-muted-foreground">
						{formatFileSize(file.size)}
					</small>
					<button
						type="button"
						className="grid size-4 shrink-0 place-items-center border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground"
						onClick={() =>
							onChange(files.filter((_, fileIndex) => fileIndex !== index))
						}
						aria-label={`Remover ${file.name}`}
					>
						<X size={11} />
					</button>
				</span>
			))}
		</>
	);
}
