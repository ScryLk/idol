import { LevelScript } from '@idol/shared';

/**
 * Placeholder do M0: prova que o editor consome o MESMO schema do game.
 * O editor visual completo chega no M5.
 */
const output = document.getElementById('output');
if (output) {
  const empty = LevelScript.safeParse({});
  output.textContent = `Schema LevelScript carregado (validação de objeto vazio: ${
    empty.success ? 'ok?!' : `${empty.error.issues.length} erros, como esperado`
  })`;
}
