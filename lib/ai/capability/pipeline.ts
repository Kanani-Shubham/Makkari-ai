import { skillRegistry } from '../skills/registry';
import { ToolDefinition } from '../tools/types';
import { buildOutputContract, formatOutputContractPrompt } from '../intent/contract-builder';
import { resolveRuntimeCapabilities, ModelCapabilityMatrix } from './truth-layer';
import { ProviderId } from '../types';

export interface CapabilityContext {
  userId?: string;
  chatId?: string;
  userPrompt: string;
  modelId?: string;
  providerId?: ProviderId;
  modelCapabilities?: Partial<ModelCapabilityMatrix>;
}

export interface ResolvedCapabilities {
  systemPromptAdditions: string;
  activeTools: ToolDefinition[];
  activeSkillNames: string[];
  activeMcpServices: string[];
}

/**
 * High-performance capability resolution pipeline (<15ms)
 * Evaluates the Output Contract, active skills, and absolute runtime tool/MCP truth.
 */
import { modelRegistry } from '../discovery/model-registry';

export async function resolveTurnCapabilities(
  context: CapabilityContext
): Promise<ResolvedCapabilities> {
  const { userPrompt, modelId = 'default', providerId = 'groq', userId, chatId, modelCapabilities } = context;

  // 1. Deterministic Intent & Output Contract (<1ms)
  const outputContract = buildOutputContract(userPrompt);
  const outputContractPrompt = formatOutputContractPrompt(outputContract);

  // 2. Keyword & metadata skill matching with forbidden skill blocking
  const skillRes = await skillRegistry.resolveSkillsForPrompt(
    userPrompt,
    outputContract.forbiddenSkills
  );
  const activeSkillNames = skillRes.activeSkills.map((s) => s.id);

  // 2.5 Query ModelRegistry capabilities if not explicitly passed
  let resolvedCaps = modelCapabilities;
  if (!resolvedCaps && providerId && modelId) {
    try {
      const regCaps = await modelRegistry.getCapabilities(providerId, modelId);
      resolvedCaps = {
        nativeTools: regCaps.nativeToolCalls,
        textToolProtocol: regCaps.tools,
        vision: regCaps.vision,
        reasoning: regCaps.reasoning,
        streaming: regCaps.streaming,
      };
    } catch {
      // safe fallback
    }
  }

  // 3. Absolute Capability & Tool Truth Resolution
  const truth = await resolveRuntimeCapabilities({
    modelId,
    providerId,
    userId,
    chatId,
    prompt: userPrompt,
    modelCapabilities: resolvedCaps,
  });


  // 4. Build manifest
  const manifestBlocks: string[] = [];

  // Prepend strict output contract if defined
  if (outputContractPrompt) {
    manifestBlocks.push(outputContractPrompt);
  }

  manifestBlocks.push('<available_capabilities>');

  if (skillRes.manifestText) {
    manifestBlocks.push(skillRes.manifestText);
  }

  if (truth.promptManifest) {
    manifestBlocks.push(truth.promptManifest);
  }

  manifestBlocks.push('</available_capabilities>');

  // 5. Append targeted active skill workflow instructions
  if (skillRes.injectedSkillContent) {
    manifestBlocks.push(skillRes.injectedSkillContent);
  }

  const activeMcpServices = truth.executableTools
    .filter((t) => t.source === 'mcp')
    .map((t) => t.name);

  return {
    systemPromptAdditions: manifestBlocks.join('\n\n'),
    activeTools: truth.executableTools,
    activeSkillNames,
    activeMcpServices,
  };
}
