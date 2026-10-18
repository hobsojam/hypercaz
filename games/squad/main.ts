const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.width = 540;
canvas.height = 960;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#fff';
ctx.font = 'bold 40px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Squad Shooter', 270, 480);
