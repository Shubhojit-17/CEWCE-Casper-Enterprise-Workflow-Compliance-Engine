// =============================================================================
// Compliance Proof Verification Page - Luminous Dark Cyberpunk Enterprise Theme
// =============================================================================
// Public page to verify compliance proofs against on-chain data.
// Works without wallet connection.
// =============================================================================

import { useState, useCallback } from 'react';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationCircleIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { api, endpoints } from '../../lib/api';
import toast from 'react-hot-toast';

interface ComplianceProofData {
  workflowId: string;
  templateId: string;
  finalState: string;
  approvedBy: string;
  approvedAt: number;
  documents: Array<{
    documentId: string;
    documentType: string;
    hash: string;
  }>;
  contractHash: string;
  deployHash: string;
  blockHash: string | null;
}

interface VerificationResult {
  verified: boolean;
  computedHash: string;
  onChainHash: string | null;
  status: string | null;
  proofDeployHash?: string;
  proofBlockHash?: string;
  confirmedAt?: string;
  explorerUrl?: string;
  error?: string;
}

interface DocumentVerificationResult {
  documentId: string;
  valid: boolean;
  expectedHash: string;
  actualHash: string;
}

export default function VerifyCompliancePage() {
  const [proofJson, setProofJson] = useState<string>('');
  const [parsedProof, setParsedProof] = useState<ComplianceProofData | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [documentResults, setDocumentResults] = useState<DocumentVerificationResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerifyingDocs, setIsVerifyingDocs] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Handle JSON paste/upload
  const handleJsonInput = useCallback((jsonString: string) => {
    setProofJson(jsonString);
    setVerificationResult(null);
    setDocumentResults([]);

    try {
      const parsed = JSON.parse(jsonString);
      // Support both raw proof and proof with _metadata wrapper
      const proofData = parsed.proof || parsed;
      
      // Validate required fields
      if (!proofData.workflowId || !proofData.finalState || !proofData.documents) {
        throw new Error('Invalid proof format');
      }
      
      setParsedProof(proofData);
    } catch {
      setParsedProof(null);
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleJsonInput(content);
    };
    reader.readAsText(file);
  }, [handleJsonInput]);

  // Verify proof against on-chain data
  const verifyProof = async () => {
    if (!parsedProof) {
      toast.error('Please provide a valid compliance proof');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const response = await api.post(endpoints.complianceProofs.verify, {
        proof: parsedProof,
      });

      setVerificationResult(response.data.data);

      if (response.data.data.verified) {
        toast.success('Compliance proof verified successfully!');
      } else {
        toast.error('Verification failed: ' + (response.data.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify proof');
    } finally {
      setIsVerifying(false);
    }
  };

  // Verify uploaded documents against proof
  const handleDocumentVerification = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !verificationResult?.computedHash) {
      toast.error('Please verify the proof first');
      return;
    }

    setIsVerifyingDocs(true);
    setDocumentResults([]);

    try {
      const documents: Array<{ id: string; content: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await readFileAsBase64(file);
        
        // Try to match by filename or use index
        const matchingDoc = parsedProof?.documents.find(
          d => file.name.includes(d.documentId)
        ) || parsedProof?.documents[i];
        
        if (matchingDoc) {
          documents.push({
            id: matchingDoc.documentId,
            content,
          });
        }
      }

      if (documents.length === 0) {
        toast.error('No documents could be matched to the proof');
        return;
      }

      const response = await api.post(endpoints.complianceProofs.verifyDocuments, {
        proofHash: verificationResult.computedHash,
        documents,
      });

      setDocumentResults(response.data.data.documentResults);

      if (response.data.data.allValid) {
        toast.success('All documents verified!');
      } else {
        toast.error('Some documents do not match the proof');
      }
    } catch (error) {
      console.error('Document verification error:', error);
      toast.error('Failed to verify documents');
    } finally {
      setIsVerifyingDocs(false);
    }
  };

  // Helper to read file as base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Copy hash to clipboard
  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <ShieldCheckIcon className="mx-auto h-16 w-16 text-red-500" />
          <h1 className="mt-4 text-3xl font-bold text-white">
            Verify Compliance Proof
          </h1>
          <p className="mt-2 text-slate-400">
            Independently verify that a workflow approval is anchored on the Casper blockchain.
            No wallet connection required.
          </p>
        </div>

        {/* Input Section */}
        <div className="glass-card mb-6">
          <div className="glass-card-body">
            <h2 className="text-lg font-medium text-white mb-4">
              Step 1: Provide Compliance Proof
            </h2>

            {/* File Upload */}
            <div className="mb-4">
              <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white/5 border-2 border-white/10 border-dashed rounded-lg cursor-pointer hover:border-red-500/50 hover:bg-white/10">
                <div className="flex flex-col items-center">
                  <ArrowUpTrayIcon className="w-8 h-8 text-slate-400" />
                  <span className="mt-2 text-sm text-slate-400">
                    Drop a compliance proof JSON file or click to upload
                  </span>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".json"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <div className="text-center text-slate-500 my-2">— or —</div>

            {/* JSON Input */}
            <textarea
              className="w-full h-48 px-4 py-2 text-sm font-mono bg-white/5 border border-white/10 rounded-lg text-slate-300 placeholder-slate-600 focus:ring-red-500 focus:border-red-500"
              placeholder='Paste compliance proof JSON here...'
              value={proofJson}
              onChange={(e) => handleJsonInput(e.target.value)}
            />

            {/* Parsed Preview */}
            {parsedProof && (
              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Proof Preview</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-500">Workflow ID:</dt>
                  <dd className="font-mono text-slate-300">{parsedProof.workflowId}</dd>
                  <dt className="text-slate-500">Final State:</dt>
                  <dd className="text-cyan-400 font-semibold">{parsedProof.finalState}</dd>
                  <dt className="text-slate-500">Approved By:</dt>
                  <dd className="font-mono text-xs text-slate-300 truncate">{parsedProof.approvedBy}</dd>
                  <dt className="text-slate-500">Documents:</dt>
                  <dd className="text-slate-300">{parsedProof.documents.length} document(s)</dd>
                  <dt className="text-slate-500">Approval Deploy:</dt>
                  <dd className="font-mono text-xs text-slate-300 truncate">{parsedProof.deployHash}</dd>
                </dl>
              </div>
            )}

            {/* Verify Button */}
            <button
              onClick={verifyProof}
              disabled={!parsedProof || isVerifying}
              className="mt-4 w-full btn-dark-primary py-3 flex items-center justify-center"
            >
              {isVerifying ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="mr-2 h-5 w-5" />
                  Verify Against Blockchain
                </>
              )}
            </button>
          </div>
        </div>

        {/* Verification Result */}
        {verificationResult && (
          <div className={`glass-card mb-6 border-l-4 ${
            verificationResult.verified ? 'border-cyan-500' : 'border-red-500'
          }`}>
            <div className="glass-card-body">
              <div className="flex items-start">
                {verificationResult.verified ? (
                  <CheckCircleIcon className="h-8 w-8 text-cyan-400 flex-shrink-0" />
                ) : (
                  <XCircleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
                )}
                <div className="ml-4 flex-1">
                  <h2 className="text-xl font-semibold text-white">
                    {verificationResult.verified ? 'Verification Successful' : 'Verification Failed'}
                  </h2>
                  <p className="mt-1 text-slate-400">
                    {verificationResult.verified
                      ? 'This compliance proof is cryptographically verified and anchored on the Casper blockchain.'
                      : verificationResult.error || 'The proof could not be verified.'}
                  </p>

                  {/* Hash Details */}
                  <div className="mt-4 space-y-3">
                    <div>
                      <span className="text-sm text-slate-500">Computed Hash:</span>
                      <div className="flex items-center mt-1">
                        <code className="text-xs bg-white/5 px-2 py-1 rounded font-mono text-slate-300 flex-1 truncate">
                          {verificationResult.computedHash}
                        </code>
                        <button
                          onClick={() => copyHash(verificationResult.computedHash)}
                          className="ml-2 text-slate-400 hover:text-white transition-colors"
                        >
                          {copiedHash ? <ClipboardDocumentCheckIcon className="h-4 w-4 text-cyan-400" /> : <ClipboardIcon className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {verificationResult.onChainHash && (
                      <div>
                        <span className="text-sm text-slate-500">On-Chain Hash:</span>
                        <code className="block mt-1 text-xs bg-white/5 px-2 py-1 rounded font-mono text-slate-300 truncate">
                          {verificationResult.onChainHash}
                        </code>
                      </div>
                    )}

                    {verificationResult.proofDeployHash && (
                      <div>
                        <span className="text-sm text-slate-500">Proof Registration Deploy:</span>
                        <div className="flex items-center mt-1">
                          <code className="text-xs bg-white/5 px-2 py-1 rounded font-mono text-slate-300 flex-1 truncate">
                            {verificationResult.proofDeployHash}
                          </code>
                          <a
                            href={verificationResult.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    )}

                    {verificationResult.confirmedAt && (
                      <div>
                        <span className="text-sm text-slate-500">Confirmed At:</span>
                        <span className="ml-2 text-sm text-slate-300">
                          {new Date(verificationResult.confirmedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Verification Section */}
        {verificationResult?.verified && parsedProof && (
          <div className="glass-card">
            <div className="glass-card-body">
              <h2 className="text-lg font-medium text-white mb-4">
                Step 2: Verify Documents (Optional)
              </h2>
              <p className="text-slate-400 mb-4">
                Upload the original documents to verify they match the hashes in the compliance proof.
              </p>

              {/* Document List from Proof */}
              <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-2">
                  Documents in Proof ({parsedProof.documents.length})
                </h3>
                <ul className="space-y-2">
                  {parsedProof.documents.map((doc) => (
                    <li key={doc.documentId} className="flex items-center text-sm">
                      <DocumentTextIcon className="h-4 w-4 text-slate-500 mr-2" />
                      <span className="font-mono text-xs text-slate-400 truncate flex-1">{doc.documentId}</span>
                      <span className="text-slate-500 ml-2">{doc.documentType}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* File Upload for Verification */}
              <label className="flex items-center justify-center w-full h-24 px-4 transition bg-white/5 border-2 border-white/10 border-dashed rounded-lg cursor-pointer hover:border-cyan-500/50 hover:bg-white/10">
                <div className="flex flex-col items-center">
                  <ArrowUpTrayIcon className="w-6 h-6 text-slate-400" />
                  <span className="mt-1 text-sm text-slate-400">
                    {isVerifyingDocs ? 'Verifying...' : 'Upload documents to verify'}
                  </span>
                </div>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleDocumentVerification}
                  disabled={isVerifyingDocs}
                />
              </label>

              {/* Document Results */}
              {documentResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-medium text-slate-300">Verification Results</h3>
                  {documentResults.map((result) => (
                    <div
                      key={result.documentId}
                      className={`flex items-center p-3 rounded-lg ${
                        result.valid ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-red-500/10 border border-red-500/20'
                      }`}
                    >
                      {result.valid ? (
                        <CheckCircleIcon className="h-5 w-5 text-cyan-400 mr-2" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      <span className="font-mono text-xs text-slate-400 flex-1 truncate">
                        {result.documentId}
                      </span>
                      <span className={`text-sm font-medium ${
                        result.valid ? 'text-cyan-400' : 'text-red-400'
                      }`}>
                        {result.valid ? 'Match' : 'Mismatch'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="flex items-start">
            <ExclamationCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
            <div className="ml-4">
              <h3 className="text-sm font-medium text-white">
                How Verification Works
              </h3>
              <ul className="mt-2 text-sm text-slate-400 list-disc list-inside space-y-1">
                <li>The proof JSON contains SHA-256 hashes of all documents reviewed at approval time</li>
                <li>A hash of the entire proof is registered on the Casper blockchain</li>
                <li>Verification computes the hash locally and compares it to the on-chain record</li>
                <li>If they match, the proof is authentic and has not been tampered with</li>
                <li>Document verification ensures the original files match the recorded hashes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
