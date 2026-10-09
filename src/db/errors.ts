/** Erreur de saisie ou de règle métier, dont le message est affichable tel quel. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
