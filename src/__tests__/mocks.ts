/**
 * Fixture strings representing real kimi CLI output for testing.
 */

/** A basic kimi response with a single TextPart */
export const SIMPLE_TEXT_OUTPUT = `TurnBegin(turn_index=0)
StepBegin(step_index=0, step_type='text_response')
TextPart(type='text', text='Hello, world!')
StepEnd(step_index=0)
TurnEnd(turn_index=0)`;

/** Response with multiple TextParts */
export const MULTI_TEXT_OUTPUT = `TurnBegin(turn_index=0)
StepBegin(step_index=0, step_type='text_response')
TextPart(type='text', text='First part. ')
TextPart(type='text', text='Second part. ')
TextPart(type='text', text='Third part.')
StepEnd(step_index=0)
TurnEnd(turn_index=0)`;

/** Response with both ThinkPart and TextPart */
export const THINKING_OUTPUT = `TurnBegin(turn_index=0)
StepBegin(step_index=0, step_type='text_response')
ThinkPart(
    type='think',
    think='Let me analyze this step by step...',
    encrypted=False
)
TextPart(type='text', text='The answer is 42.')
StepEnd(step_index=0)
TurnEnd(turn_index=0)`;

/** Raw text without TextPart wrappers (fallback case) */
export const PLAIN_TEXT_OUTPUT = `TurnBegin(turn_index=0)
StepBegin(step_index=0, step_type='text_response')
This is plain text output
that spans multiple lines.
StepEnd(step_index=0)
TurnEnd(turn_index=0)`;

/** Empty string */
export const EMPTY_OUTPUT = '';

/** TextPart with escaped characters (\n, \', \") */
export const ESCAPED_OUTPUT = `TurnBegin(turn_index=0)
StepBegin(step_index=0, step_type='text_response')
TextPart(type='text', text='Line one\\nLine two\\nHe said \\\'hello\\\' and \\"goodbye\\"')
StepEnd(step_index=0)
TurnEnd(turn_index=0)`;
