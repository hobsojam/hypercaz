import { mountRicochet } from './mount.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const status = document.querySelector<HTMLElement>('#status')!;
mountRicochet(canvas, {
  onStatus: message => { status.textContent = message; },
  onError: error => { console.error(error); showError(); },
}).catch(error => { console.error(error); showError(); });

function showError(): void {
  const message = document.createElement('p');
  message.textContent = 'Ricochet Rescue could not start. Reload this page to try again.';
  message.style.cssText = 'position:fixed;inset:35% 10% auto;padding:24px;background:#fff8df;color:#173d48;border-radius:16px;text-align:center';
  document.body.append(message);
}
