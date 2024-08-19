package main

import "fmt"

type Person struct {
	Test  int
	Other string
}

func HelloVet() {
	fmt.Println("Hello Vet")

	return

	fmt.Println("This line will never be executed")
}
