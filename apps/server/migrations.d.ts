declare module "@server/db/do/migrations/migrations.js" {
	interface MigrationJournal {
		entries: {
			idx: number;
			when: number;
			tag: string;
			breakpoints: boolean;
		}[];
	}

	interface MigrationBundle {
		journal: MigrationJournal;
		migrations: Record<string, string>;
	}

	const migrations: MigrationBundle;

	export default migrations;
}
