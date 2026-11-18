import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  async function render() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const inputs = element.querySelectorAll('input');
    return { fixture, element, nameInput: inputs[0]!, emailInput: inputs[1]! };
  }

  async function type(
    fixture: { whenStable(): Promise<unknown> },
    input: HTMLInputElement,
    value: string,
  ) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('lists customers with loyalty points', async () => {
    const { element } = await render();
    const items = element.querySelectorAll('.customer-list li');
    expect(items.length).toBe(2);
    expect(items[0]!.textContent).toContain('Olena Kovalenko');
    expect(items[0]!.textContent).toContain('0 points');
  });

  it('adds a customer from the form and clears it', async () => {
    const { fixture, element, nameInput, emailInput } = await render();
    await type(fixture, nameInput, 'Iryna Bondar');
    await type(fixture, emailInput, 'iryna@example.com');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(element.querySelectorAll('.customer-list li').length).toBe(3);
    expect(nameInput.value).toBe('');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the validation error to the user', async () => {
    const { fixture, element, nameInput, emailInput } = await render();
    await type(fixture, nameInput, 'No Email');
    await type(fixture, emailInput, 'not-an-email');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain('email is not valid');
  });
});
