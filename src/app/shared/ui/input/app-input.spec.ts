import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppInput } from './app-input';

@Component({
  imports: [AppInput],
  template: `<app-input
    label="Email"
    type="email"
    placeholder="you@example.com"
    [(value)]="email"
  />`,
})
class Host {
  readonly email = signal('initial@example.com');
}

describe('AppInput', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      input: element.querySelector('input')!,
      label: element.querySelector('label')!,
    };
  }

  it('renders label, type, placeholder and value', async () => {
    const { input, label } = await render();
    expect(label.textContent).toContain('Email');
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('you@example.com');
    expect(input.value).toBe('initial@example.com');
    expect(label.htmlFor).toBe(input.id);
  });

  it('writes typed text back to the bound value', async () => {
    const { fixture, input } = await render();
    input.value = 'new@example.com';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.email()).toBe('new@example.com');
  });
});
