import { describe, expect, it } from 'vitest';
import { AgentContext, processAgentInput } from '../src/client/utils/agent';

const baseContext: AgentContext = {
  role: 'User',
  orders: [],
  conversationHistory: [],
};

describe('local NLP command model', () => {
  it('extracts a manufacturing order command', () => {
    const action = processAgentInput('I need 120 titanium flanges, grade 5, by July 20', baseContext);

    expect(action.type).toBe('CREATE_ORDER');
    expect(action.data).toMatchObject({
      partName: 'Titanium Flanges',
      material: 'Titanium',
      quantity: 120,
      deadline: 'July 20',
    });
    expect(action.data.specs).toContain('grade 5');
  });

  it('classifies manufacturer status commands and extracts the target state', () => {
    const action = processAgentInput('Mark order #3 as accepted', {
      ...baseContext,
      role: 'Manufacturer',
    });

    expect(action.type).toBe('UPDATE_STATUS');
    expect(action.data).toMatchObject({ orderNum: 3, status: 'Accepted' });
  });

  it('uses conversation context for follow-up progress commands', () => {
    const action = processAgentInput('move it forward', {
      ...baseContext,
      role: 'Manufacturer',
      lastOrderNum: 7,
    });

    expect(action.type).toBe('PROGRESS_STATUS');
    expect(action.data.orderNum).toBe(7);
  });

  it('extracts quality notes without command boilerplate', () => {
    const action = processAgentInput('Quality update on order #9: passed dimensional inspection', {
      ...baseContext,
      role: 'Manufacturer',
    });

    expect(action.type).toBe('ADD_QUALITY_NOTE');
    expect(action.data).toMatchObject({
      orderNum: 9,
      remarks: 'passed dimensional inspection',
    });
  });

  it('detects material and status filters', () => {
    const action = processAgentInput('Show all titanium orders in manufacturing', {
      ...baseContext,
      role: 'Manufacturer',
    });

    expect(action.type).toBe('QUERY_FILTER');
    expect(action.data).toMatchObject({
      filterMaterial: 'Titanium',
      filterStatus: 'Manufacturing',
    });
  });
});
