declare module 'pug' {
  export function render(template: string, options?: Record<string, unknown>): string;
  const pug: { render: typeof render };
  export default pug;
}
