import type { PropsWithChildren } from "react";

export function AuthLayout({ children }: PropsWithChildren) {
	return (
		<main className="grid min-h-svh grid-cols-[70%_30%] bg-background max-shell:grid-cols-1">
			<section
				className="auth-hero relative isolate flex min-h-svh items-center overflow-hidden border-r border-border bg-[var(--background-beige)] p-10 wide:p-12 max-shell:min-h-[500px] max-shell:border-r-0 max-shell:border-b max-shell:p-8 max-mobile:min-h-[360px] max-mobile:p-5 dark:bg-background"
				aria-label="Apresentação do Open Cash"
			>
				<div
					className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(color-mix(in_oklab,var(--foreground)_14%,transparent)_0.7px,transparent_0.7px)] [background-size:8px_8px]"
					aria-hidden="true"
				/>
				<div className="auth-hero-content relative z-10 mx-auto grid w-full max-w-[1360px] grid-cols-[minmax(300px,0.72fr)_minmax(430px,1fr)] items-center gap-[clamp(1rem,1.5vw,2rem)]">
					<div className="auth-hero-copy min-w-0 max-w-[420px] -translate-y-5 justify-self-end">
						<p className="text-[clamp(2.25rem,3.2vw,3.6rem)] leading-[0.98] font-semibold tracking-[-0.055em] text-foreground max-shell:text-[clamp(2rem,6vw,3.25rem)] max-mobile:text-[1.75rem]">
							Open Finance +{" "}
							<span className="font-normal italic">inteligência agêntica.</span>
						</p>
						<p className="mt-5 max-w-[390px] text-sm leading-6 text-muted-foreground max-mobile:hidden">
							Conecte suas contas e converse com um agente que entende o contexto
							completo do seu dinheiro.
						</p>
					</div>
					<img
						className="auth-hero-art pointer-events-none w-full max-w-[560px] justify-self-start drop-shadow-[0_24px_50px_rgb(0_0_0/0.16)]"
						src="/brand/onca-vermelha-transparente.png"
						alt="Onça avançando diante de um círculo vermelho"
					/>
				</div>
			</section>

			<section className="grid min-h-svh place-items-center bg-card px-6 py-10 max-shell:min-h-0 max-shell:py-12 max-mobile:px-5">
				{children}
			</section>
		</main>
	);
}
