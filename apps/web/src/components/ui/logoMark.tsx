export function LogoMark({ size = 20 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			aria-hidden="true"
			focusable="false"
		>
			<title>Open Cash</title>
			<path
				d="M10 0.5 11.6 6.3 16.4 2.7 13.7 7.6 19.5 8.4 14.2 10 19.5 11.6 13.7 12.4 16.4 17.3 11.6 13.7 10 19.5 8.4 13.7 3.6 17.3 6.3 12.4 0.5 11.6 5.8 10 0.5 8.4 6.3 7.6 3.6 2.7 8.4 6.3Z"
				fill="currentColor"
			/>
		</svg>
	);
}
