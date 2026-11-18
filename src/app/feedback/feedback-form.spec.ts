import { TestBed } from '@angular/core/testing';
import { Feedback, FeedbackForm } from './feedback-form';

describe('FeedbackForm', () => {
  async function render() {
    const fixture = TestBed.createComponent(FeedbackForm);
    const sent: Feedback[] = [];
    fixture.componentInstance.submitted.subscribe((feedback) => sent.push(feedback));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const [name, email, subscribe] = Array.from(element.querySelectorAll('input'));
    const message = element.querySelector('textarea')!;
    const submit = async () => {
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return {
      fixture,
      element,
      sent,
      name: name!,
      email: email!,
      subscribe: subscribe!,
      message,
      submit,
    };
  }

  async function type(
    fixture: { whenStable(): Promise<unknown> },
    field: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('emits trimmed feedback and clears the form', async () => {
    const { fixture, sent, name, email, subscribe, message, submit } = await render();
    await type(fixture, name, ' Olena ');
    await type(fixture, email, ' olena@example.com ');
    await type(fixture, message, ' Great service ');
    subscribe.checked = true;
    subscribe.dispatchEvent(new Event('change'));
    await submit();

    expect(sent).toEqual([
      { name: 'Olena', email: 'olena@example.com', message: 'Great service', subscribe: true },
    ]);
    expect(name.value).toBe('');
    expect(email.value).toBe('');
    expect(message.value).toBe('');
  });

  it('shows an error when name or message is missing', async () => {
    const { fixture, element, sent, name, submit } = await render();
    await type(fixture, name, 'Olena');
    await submit();

    expect(sent).toEqual([]);
    expect(element.querySelector('[role="alert"]')!.textContent).toContain(
      'Name and message are required',
    );
  });
});
