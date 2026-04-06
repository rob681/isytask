"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, XCircle, Zap } from "lucide-react";

interface QAReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  duration: number;
  results: Array<{
    name: string;
    status: "PASS" | "FAIL" | "WARN";
    duration: number;
    error?: string;
  }>;
  summary: {
    workingFeatures: string[];
    brokenFeatures: string[];
    improvementSuggestions: string[];
  };
}

export function QATestingWidget() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<QAReport | null>(null);
  const [expandedResults, setExpandedResults] = useState(false);

  const runTests = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cron/qa-testing", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to run tests: ${response.statusText}`);
      }

      const data = await response.json();
      setReport(data.report);
    } catch (error) {
      console.error("Error running QA tests:", error);
      alert(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  if (!report) {
    return (
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              QA Testing Suite
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Run comprehensive tests across all Isytask functionalities. This will create test data,
              execute all workflows, and generate a detailed report.
            </p>
          </div>
        </div>
        <Button
          onClick={runTests}
          disabled={loading}
          className="w-full sm:w-auto gradient-primary text-white"
        >
          {loading ? "Testing..." : "Run QA Tests"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="font-display font-bold text-lg mb-4">QA Testing Report</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Generated: {new Date(report.timestamp).toLocaleString()}
        </p>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {report.totalTests}
            </div>
            <div className="text-xs text-muted-foreground">Total Tests</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {report.passed}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Passed</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <div className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-red-600" />
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {report.failed}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {(report.duration / 1000).toFixed(1)}s
            </div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
        </div>

        {/* Working Features */}
        <div className="mb-6">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Working Features ({report.summary.workingFeatures.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.summary.workingFeatures.map((feature, idx) => (
              <div
                key={idx}
                className="text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded px-3 py-2 border border-green-200 dark:border-green-800"
              >
                ✓ {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Broken Features */}
        {report.summary.brokenFeatures.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Broken Features ({report.summary.brokenFeatures.length})
            </h4>
            <div className="space-y-2">
              {report.summary.brokenFeatures.map((feature, idx) => (
                <div
                  key={idx}
                  className="text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded px-3 py-2 border border-red-200 dark:border-red-800"
                >
                  ✗ {feature}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvement Suggestions */}
        <div className="mb-6">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Improvement Suggestions
          </h4>
          <div className="space-y-1">
            {report.summary.improvementSuggestions.map((suggestion, idx) => (
              <div key={idx} className="text-sm text-muted-foreground">
                {suggestion}
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Results Toggle */}
        <div>
          <button
            onClick={() => setExpandedResults(!expandedResults)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-2"
          >
            {expandedResults ? "Hide" : "Show"} Detailed Results ({report.results.length})
          </button>
          {expandedResults && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {report.results.map((result, idx) => (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded border ${
                    result.status === "PASS"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : result.status === "FAIL"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                  }`}
                >
                  <div className="font-medium flex items-center gap-2">
                    {result.status === "PASS" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : result.status === "FAIL" ? (
                      <XCircle className="h-3 w-3 text-red-600" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                    )}
                    {result.name}
                  </div>
                  <div className="text-muted-foreground ml-5">
                    Duration: {result.duration}ms
                    {result.error && ` | Error: ${result.error}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Run Again Button */}
      <Button
        onClick={runTests}
        disabled={loading}
        variant="outline"
        className="w-full sm:w-auto"
      >
        {loading ? "Testing..." : "Run QA Tests Again"}
      </Button>
    </Card>
  );
}
