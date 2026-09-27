{{- define "openstatus.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "openstatus.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{/* selector labels: call with (dict "ctx" $ "component" "server") */}}
{{- define "openstatus.selectorLabels" -}}
app.kubernetes.io/name: {{ .ctx.Chart.Name }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "openstatus.component" -}}
{{- printf "%s-%s" (include "openstatus.fullname" .ctx) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "openstatus.image" -}}
{{- printf "%s/%s:%s" .ctx.Values.image.registry .name .ctx.Values.image.tag -}}
{{- end -}}

{{- define "openstatus.secretName" -}}
{{- default (printf "%s-env" (include "openstatus.fullname" .)) .Values.secrets.existingSecret -}}
{{- end -}}

{{- define "openstatus.tinybirdSecretName" -}}
{{- default (printf "%s-tinybird-token" (include "openstatus.fullname" .)) .Values.tinybird.existingSecret -}}
{{- end -}}

{{- define "openstatus.url" -}}
{{- printf "http://%s:%v" (include "openstatus.component" (dict "ctx" .ctx "component" .component)) .port -}}
{{- end -}}

{{/* envFrom shared by every app: the chart's `.env.docker` equivalent */}}
{{- define "openstatus.envFrom" -}}
- configMapRef:
    name: {{ include "openstatus.fullname" . }}-env
- secretRef:
    name: {{ include "openstatus.secretName" . }}
- secretRef:
    name: {{ include "openstatus.tinybirdSecretName" . }}
    optional: true
{{- end -}}

{{- define "openstatus.scheduling" -}}
{{- with .Values.nodeSelector }}
nodeSelector:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.tolerations }}
tolerations:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.affinity }}
affinity:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.imagePullSecrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.podSecurityContext }}
securityContext:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end -}}
