import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readComponent = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('SSR-safe primitive wrappers', () => {
  it.each([
    ['app/components/ui/badge/Badge.vue', "as: 'span'"],
    ['app/components/ui/button/Button.vue', "as: 'button'"],
    ['app/components/ui/sidebar/SidebarGroupAction.vue', "as: 'button'"],
    ['app/components/ui/sidebar/SidebarGroupLabel.vue', "as: 'div'"],
    ['app/components/ui/sidebar/SidebarMenuAction.vue', "as: 'button'"],
    ['app/components/ui/sidebar/SidebarMenuButtonChild.vue', "as: 'button'"],
    ['app/components/ui/sidebar/SidebarMenuSubButton.vue', "as: 'a'"],
  ])('%s defines a concrete default Primitive element', (componentPath, expectedDefault) => {
    const source = readComponent(componentPath);

    expect(source).toContain('withDefaults');
    expect(source).toContain(expectedDefault);
  });
});
