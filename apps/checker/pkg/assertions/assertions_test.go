package assertions

import (
	"testing"

	"github.com/openstatushq/openstatus/apps/checker/request"
)

func TestIntTarget_IntEvaluate(t *testing.T) {
	type fields struct {
		AssertionType request.AssertionType
		Comparator    request.NumberComparator
		Target        int64
	}
	type args struct {
		value int64
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   bool
	}{
		{
			name: "Equals true", fields: fields{Comparator: request.NumberEquals, Target: 200}, args: args{value: 200}, want: true,
		},
		{
			name: "Equals false", fields: fields{Comparator: request.NumberEquals, Target: 200}, args: args{value: 201}, want: false,
		},
		{
			name: "Not Equals true", fields: fields{Comparator: request.NumberNotEquals, Target: 200}, args: args{value: 201}, want: true,
		},
		{
			name: "Not Equals false", fields: fields{Comparator: request.NumberNotEquals, Target: 200}, args: args{value: 200}, want: false,
		},
		{
			name: "greater than true", fields: fields{Comparator: request.NumberGreaterThan, Target: 200}, args: args{value: 201}, want: true,
		},
		{
			name: "greater than false 1", fields: fields{Comparator: request.NumberGreaterThan, Target: 200}, args: args{value: 200}, want: false,
		},
		{
			name: "greater than false", fields: fields{Comparator: request.NumberGreaterThan, Target: 200}, args: args{value: 199}, want: false,
		},
		{
			name: "greater than equal true", fields: fields{Comparator: request.NumberGreaterThanEqual, Target: 200}, args: args{value: 201}, want: true,
		},
		{
			name: "greater than equal true 1", fields: fields{Comparator: request.NumberGreaterThanEqual, Target: 200}, args: args{value: 200}, want: true,
		},
		{
			name: "greater than equal false", fields: fields{Comparator: request.NumberGreaterThanEqual, Target: 200}, args: args{value: 199}, want: false,
		},
		{
			name: "lower than true", fields: fields{Comparator: request.NumberLowerThan, Target: 200}, args: args{value: 199}, want: true,
		},
		{
			name: "lower  than false 1", fields: fields{Comparator: request.NumberLowerThan, Target: 200}, args: args{value: 200}, want: false,
		},
		{
			name: "lower than false", fields: fields{Comparator: request.NumberLowerThan, Target: 200}, args: args{value: 201}, want: false,
		},
		{
			name: "lower than Equal true", fields: fields{Comparator: request.NumberLowerThanEqual, Target: 200}, args: args{value: 199}, want: true,
		},
		{
			name: "lower  than  equal true 1", fields: fields{Comparator: request.NumberLowerThanEqual, Target: 200}, args: args{value: 200}, want: true,
		},
		{
			name: "lower than equal false", fields: fields{Comparator: request.NumberLowerThan, Target: 200}, args: args{value: 201}, want: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target := StatusTarget{
				AssertionType: tt.fields.AssertionType,
				Comparator:    tt.fields.Comparator,
				Target:        tt.fields.Target,
			}
			if got := target.StatusEvaluate(tt.args.value); got != tt.want {
				t.Errorf("IntTarget.IntEvaluate() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestHeaderTarget_HeaderEvaluate(t *testing.T) {
	type fields struct {
		AssertionType request.AssertionType
		Comparator    request.StringComparator
		Target        string
		Key           string
	}
	type args struct {
		s string
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   bool
	}{
		{name: "Header 1", fields: fields{Comparator: request.StringEmpty, Target: "", Key: "headers1"}, args: args{s: `{"Content-Type":"text/plain;charset=UTF-8","Strict-Transport-Security":"max-age=3153600000","Vary":"Accept-Encoding"}`}, want: false},
		{name: "Header 2", fields: fields{Comparator: request.StringNotEmpty, Target: "", Key: "headers1"}, args: args{s: `{"Content-Type":"text/plain;charset=UTF-8","Strict-Transport-Security":"max-age=3153600000","headers1":"Accept-Encoding"}`}, want: true},
		{name: "it should return false if it can not decode the headers", fields: fields{Comparator: request.StringContains, Target: "Accept-Encoding", Key: "Vary"}, args: args{s: `}`}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			target := HeaderTarget{
				AssertionType: tt.fields.AssertionType,
				Comparator:    tt.fields.Comparator,
				Target:        tt.fields.Target,
				Key:           tt.fields.Key,
			}
			if got := target.HeaderEvaluate(tt.args.s); got != tt.want {
				t.Errorf("HeaderTarget.HeaderEvaluate() = %v, want %v", got, tt.want)
			}
		})
	}
}
